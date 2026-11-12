// PokeSave Link: homebrew de 3DS para editar tu partida con PokeSave desde el navegador.
//
//  1. Detecta los Pokémon de 3DS instalados (tarjeta o digital): X/Y, Rubí Omega/Zafiro Alfa,
//     Sol/Luna y Ultrasol/Ultraluna.
//  2. Eliges uno y hace una COPIA de la partida en la SD antes de nada:
//     sdmc:/3ds/PokeSave/backups/<juego>/<fecha>.main
//  3. Arranca un servidor en tu wifi (puerto 8000). Desde el móvil o el PC abres la dirección
//     que sale en pantalla: la web se sirve desde la SD (sdmc:/3ds/PokeSave/web/), así que es
//     la misma PokeSave, pero conectada a la consola.
//  4. Al pulsar "Guardar en la 3DS" la web manda la partida con el PIN de la pantalla; la app
//     hace otra copia de lo que había y sobrescribe la partida. Sales con START y abres el juego.
//
// Partidas que encuentra:
//  - Juegos de 3DS (tarjeta o digital): X/Y, ROZA, SL, USUL → archivo "main" de su partida.
//  - Consola Virtual (Rojo/Azul/Amarillo, Oro/Plata/Cristal…): "sav.dat" de su partida.
//  - Cartucho de DS metido en la consola (Diamante/Perla/Platino, HG/SS, Negro/Blanco y
//    Negro 2/Blanco 2): se lee y escribe el chip de memoria del cartucho (ver spi.c).
//  - Cualquier .sav de la SD ("Buscar un .sav en la SD"): juegos de DS con TWiLight Menu++,
//    emuladores, copias… Se sobrescribe el mismo archivo (a través de un temporal).
// Siempre hay copia en sdmc:/3ds/PokeSave/backups/ antes de escribir.
//
// API (mismo origen que la web):
//   GET  /api/info  → {"app":"PokeSave Link","game":"X","label":"Pokemon X","file":"main","size":415232}
//   GET  /api/save  → la partida (bytes)
//   POST /api/save  → cabecera X-PokeSave-Pin con el PIN; cuerpo = partida del mismo tamaño
#include <3ds.h>
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <malloc.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <dirent.h>
#include "spi.h"

#define PORT 8000
#define SOC_ALIGN 0x1000
#define SOC_BUFFERSIZE 0x100000
#define WEB_ROOT "sdmc:/3ds/PokeSave/web"
#define BACKUP_ROOT "sdmc:/3ds/PokeSave/backups"
#define MAX_SAVE (1024 * 1024)

typedef struct {
	u64 id;
	const char *code; // código de versión de PKHeX, el mismo que usa la web
	const char *name;
} Game;

// Los juegos de 3DS tienen el mismo ID en todas las regiones.
static const Game GAMES[] = {
	{0x0004000000055D00ULL, "X", "Pokemon X"},
	{0x0004000000055E00ULL, "Y", "Pokemon Y"},
	{0x000400000011C400ULL, "OR", "Pokemon Rubi Omega"},
	{0x000400000011C500ULL, "AS", "Pokemon Zafiro Alfa"},
	{0x0004000000164800ULL, "SN", "Pokemon Sol"},
	{0x0004000000175E00ULL, "MN", "Pokemon Luna"},
	{0x00040000001B5000ULL, "US", "Pokemon Ultrasol"},
	{0x00040000001B5100ULL, "UM", "Pokemon Ultraluna"},
};
#define GAME_COUNT (sizeof(GAMES) / sizeof(GAMES[0]))

/** De dónde sale la partida. */
typedef enum {
	SRC_TITLE, // archivo dentro de la partida de un juego de 3DS o de la Consola Virtual
	SRC_NDS,   // chip de memoria del cartucho de DS
	SRC_SD,    // archivo .sav de la tarjeta SD
} Source;

/** Juegos de DS (por las 3 primeras letras del código del cartucho) → código de PKHeX. */
static const struct { const char *prefix, *code, *name; } DS_GAMES[] = {
	{"ADA", "D", "Pokemon Diamante"}, {"APA", "P", "Pokemon Perla"}, {"CPU", "Pt", "Pokemon Platino"},
	{"IPK", "HG", "Pokemon Oro HeartGold"}, {"IPG", "SS", "Pokemon Plata SoulSilver"},
	{"IRB", "B", "Pokemon Negro"}, {"IRA", "W", "Pokemon Blanco"}, {"IRE", "B2", "Pokemon Negro 2"}, {"IRD", "W2", "Pokemon Blanco 2"},
};

/** Partida elegida. */
typedef struct {
	Source kind;
	const Game *game;   // juego de 3DS conocido (o NULL)
	u64 id;             // título de 3DS / Consola Virtual
	FS_MediaType media;
	char inner[16];     // "/main" o "/sav.dat"
	char code[8];       // código para la web: X, SN, W, VC, SD…
	char label[64];     // lo que se enseña en pantalla
	char path[384];     // SRC_SD
	CardType spi;       // SRC_NDS
	u32 spiSize;
} Found;

static const char *baseName(const char *path) {
	const char *s = strrchr(path, '/');
	return s ? s + 1 : path;
}

static u32 *socBuffer;
static u8 *saveData;
static u32 saveSize;
static const Found *current;
static char pin[8];

// ---------- Partida ----------

static Result openSaveArchive(const Found *f, FS_Archive *archive) {
	u32 path[3] = {f->media, (u32)(f->id & 0xFFFFFFFF), (u32)(f->id >> 32)};
	return FSUSER_OpenArchive(archive, ARCHIVE_USER_SAVEDATA, (FS_Path){PATH_BINARY, sizeof(path), path});
}

// ---------- Archivo de la SD ----------

static Result readSdFile(const char *path) {
	FILE *fp = fopen(path, "rb");
	if (!fp) return -1;
	fseek(fp, 0, SEEK_END);
	long size = ftell(fp);
	fseek(fp, 0, SEEK_SET);
	if (size <= 0 || size > MAX_SAVE) {
		fclose(fp);
		return -1;
	}
	free(saveData);
	saveData = malloc(size);
	saveSize = fread(saveData, 1, size, fp);
	fclose(fp);
	return saveSize == (u32)size ? 0 : -1;
}

/** Se escribe en un temporal y luego se cambia por el original: nunca queda a medias. */
static Result writeSdFile(const char *path, const u8 *data, u32 size) {
	char tmp[400];
	snprintf(tmp, sizeof(tmp), "%s.pstmp", path);
	FILE *fp = fopen(tmp, "wb");
	if (!fp) return -1;
	bool ok = fwrite(data, 1, size, fp) == size;
	ok = fclose(fp) == 0 && ok;
	if (!ok) {
		remove(tmp);
		return -1;
	}
	remove(path);
	return rename(tmp, path) == 0 ? 0 : -1;
}

// ---------- Cartucho de DS ----------

static Result readNds(const Found *f) {
	free(saveData);
	saveData = malloc(f->spiSize);
	const u32 chunk = 0x10000; // como Checkpoint: de 64 KB en 64 KB
	for (u32 pos = 0; pos < f->spiSize; pos += chunk) {
		Result res = spiRead(f->spi, pos, saveData + pos, chunk);
		if (R_FAILED(res)) return res;
	}
	saveSize = f->spiSize;
	return 0;
}

/** Escribe y luego lo vuelve a leer para comprobar que el chip tiene exactamente lo enviado. */
static Result writeNds(const Found *f, const u8 *data, u32 size) {
	if (size != f->spiSize) return -1;
	Result res = spiWrite(f->spi, 0, data, size);
	if (R_FAILED(res)) return res;
	u8 *check = malloc(0x10000);
	for (u32 pos = 0; pos < size && R_SUCCEEDED(res); pos += 0x10000) {
		res = spiRead(f->spi, pos, check, 0x10000);
		if (R_SUCCEEDED(res) && memcmp(check, data + pos, 0x10000) != 0) res = -2;
	}
	free(check);
	return res;
}

static Result readSave(const Found *f) {
	if (f->kind == SRC_SD) return readSdFile(f->path);
	if (f->kind == SRC_NDS) return readNds(f);
	FS_Archive archive;
	Handle file;
	Result res = openSaveArchive(f, &archive);
	if (R_FAILED(res)) return res;
	res = FSUSER_OpenFile(&file, archive, fsMakePath(PATH_ASCII, f->inner), FS_OPEN_READ, 0);
	if (R_SUCCEEDED(res)) {
		u64 size = 0;
		FSFILE_GetSize(file, &size);
		if (size == 0 || size > MAX_SAVE) {
			res = -1;
		} else {
			free(saveData);
			saveData = malloc(size);
			u32 read = 0;
			res = FSFILE_Read(file, &read, 0, saveData, (u32)size);
			saveSize = read;
			if (R_SUCCEEDED(res) && read != size) res = -1;
		}
		FSFILE_Close(file);
	}
	FSUSER_CloseArchive(archive);
	return res;
}

static Result writeSave(const Found *f, const u8 *data, u32 size) {
	if (f->kind == SRC_SD) return writeSdFile(f->path, data, size);
	if (f->kind == SRC_NDS) return writeNds(f, data, size);
	FS_Archive archive;
	Handle file;
	Result res = openSaveArchive(f, &archive);
	if (R_FAILED(res)) return res;
	res = FSUSER_OpenFile(&file, archive, fsMakePath(PATH_ASCII, f->inner), FS_OPEN_WRITE, 0);
	if (R_SUCCEEDED(res)) {
		u32 written = 0;
		res = FSFILE_Write(file, &written, 0, data, size, FS_WRITE_FLUSH);
		FSFILE_Close(file);
		if (R_SUCCEEDED(res) && written != size) res = -1;
	}
	// Sin este "commit" el juego seguiría viendo la partida de antes.
	if (R_SUCCEEDED(res)) res = FSUSER_ControlArchive(archive, ARCHIVE_ACTION_COMMIT_SAVE_DATA, NULL, 0, NULL, 0);
	FSUSER_CloseArchive(archive);
	return res;
}

static void mkdirs(const char *path) {
	char tmp[256];
	snprintf(tmp, sizeof(tmp), "%s", path);
	for (char *p = tmp + 6; *p; p++) { // después de "sdmc:/"
		if (*p == '/') {
			*p = 0;
			mkdir(tmp, 0777);
			*p = '/';
		}
	}
	mkdir(tmp, 0777);
}

/**
 * Copia de seguridad: sdmc:/3ds/PokeSave/backups/<juego>/<AAAAMMDD-HHMMSS>-<tag>.main
 * (o backups/sd/<archivo>-<fecha>-<tag>.sav para los archivos de la SD).
 */
static bool backup(const char *tag) {
	char dir[160], file[400];
	snprintf(dir, sizeof(dir), "%s/%s", BACKUP_ROOT, current->kind == SRC_SD ? "sd" : current->code);
	mkdirs(dir);
	time_t now = time(NULL);
	struct tm *t = gmtime(&now);
	const char *ext = current->kind == SRC_NDS ? "sav" : !strcmp(current->inner, "/sav.dat") ? "dat" : "main";
	if (current->kind != SRC_SD)
		snprintf(file, sizeof(file), "%s/%04d%02d%02d-%02d%02d%02d-%s.%s", dir, t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec, tag, ext);
	else
		snprintf(file, sizeof(file), "%s/%.150s-%04d%02d%02d-%02d%02d%02d-%s.bak", dir, baseName(current->path), t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec, tag);
	FILE *fp = fopen(file, "wb");
	if (!fp) return false;
	bool ok = fwrite(saveData, 1, saveSize, fp) == saveSize;
	fclose(fp);
	if (ok) printf("Copia: %s\n", file + 5);
	return ok;
}

// ---------- HTTP ----------

/** Busca una cabecera sin distinguir mayúsculas ("
content-length:"…). */
static char *findHeader(char *headers, const char *name) {
	size_t n = strlen(name);
	for (char *p = headers; *p; p++) {
		if (strncasecmp(p, name, n) == 0) return p;
	}
	return NULL;
}

static void sendAll(int s, const void *data, size_t len) {
	const u8 *p = data;
	while (len > 0) {
		ssize_t n = send(s, p, len > 0x4000 ? 0x4000 : len, 0);
		if (n <= 0) {
			if (n < 0 && errno == EAGAIN) {
				svcSleepThread(1000000);
				continue;
			}
			return;
		}
		p += n;
		len -= n;
	}
}

static void reply(int s, const char *status, const char *type, const void *body, size_t len) {
	char head[256];
	int n = snprintf(head, sizeof(head), "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %u\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", status, type, (unsigned)len);
	sendAll(s, head, n);
	if (len) sendAll(s, body, len);
}

static void replyText(int s, const char *status, const char *json) {
	reply(s, status, "application/json", json, strlen(json));
}

static const char *mimeOf(const char *path) {
	const char *ext = strrchr(path, '.');
	if (!ext) return "application/octet-stream";
	if (!strcmp(ext, ".html")) return "text/html; charset=utf-8";
	if (!strcmp(ext, ".js") || !strcmp(ext, ".mjs")) return "text/javascript";
	if (!strcmp(ext, ".css")) return "text/css";
	if (!strcmp(ext, ".json")) return "application/json";
	if (!strcmp(ext, ".wasm")) return "application/wasm";
	if (!strcmp(ext, ".svg")) return "image/svg+xml";
	if (!strcmp(ext, ".png")) return "image/png";
	if (!strcmp(ext, ".woff2")) return "font/woff2";
	return "application/octet-stream";
}

static void serveFile(int s, const char *urlPath) {
	char path[512];
	// Nada de salir de la carpeta de la web.
	if (strstr(urlPath, "..")) {
		replyText(s, "400 Bad Request", "{\"error\":\"path\"}");
		return;
	}
	const char *q = strchr(urlPath, '?');
	int len = q ? (int)(q - urlPath) : (int)strlen(urlPath);
	snprintf(path, sizeof(path), "%s%.*s", WEB_ROOT, len, urlPath);
	if (path[strlen(path) - 1] == '/') strncat(path, "index.html", sizeof(path) - strlen(path) - 1);
	struct stat st;
	if (stat(path, &st) == 0 && S_ISDIR(st.st_mode)) strncat(path, "/index.html", sizeof(path) - strlen(path) - 1);
	FILE *fp = fopen(path, "rb");
	if (!fp) {
		const char *msg = "<h1>404</h1><p>Copia la web de PokeSave en sdmc:/3ds/PokeSave/web/</p>";
		reply(s, "404 Not Found", "text/html; charset=utf-8", msg, strlen(msg));
		return;
	}
	fseek(fp, 0, SEEK_END);
	long size = ftell(fp);
	fseek(fp, 0, SEEK_SET);
	char head[256];
	int n = snprintf(head, sizeof(head), "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %ld\r\nConnection: close\r\n\r\n", mimeOf(path), size);
	sendAll(s, head, n);
	static u8 chunk[0x8000];
	size_t r;
	while ((r = fread(chunk, 1, sizeof(chunk), fp)) > 0) sendAll(s, chunk, r);
	fclose(fp);
}

/** Lee la petición entera (cabeceras + cuerpo según Content-Length). */
static int readRequest(int s, u8 **out, int *headerLen) {
	int cap = 0x10000, len = 0;
	u8 *buf = malloc(cap);
	*headerLen = -1;
	int contentLength = 0;
	u64 start = osGetTime();
	while (osGetTime() - start < 15000) {
		if (len == cap) {
			if (cap >= MAX_SAVE + 0x10000) break;
			cap *= 2;
			buf = realloc(buf, cap);
		}
		ssize_t n = recv(s, buf + len, cap - len, 0);
		if (n == 0) break;
		if (n < 0) {
			if (errno == EAGAIN) {
				svcSleepThread(1000000);
				continue;
			}
			break;
		}
		len += n;
		if (*headerLen < 0) {
			for (int i = 3; i < len; i++) {
				if (buf[i - 3] == '\r' && buf[i - 2] == '\n' && buf[i - 1] == '\r' && buf[i] == '\n') {
					*headerLen = i + 1;
					buf[i - 1] = 0; // las cabeceras quedan como texto
					char *cl = findHeader((char *)buf, "\nContent-Length:");
					contentLength = cl ? atoi(cl + 16) : 0;
					break;
				}
			}
		}
		if (*headerLen >= 0 && len >= *headerLen + contentLength) break;
	}
	*out = buf;
	return len;
}

static void handle(int s) {
	u8 *req;
	int headerLen;
	int len = readRequest(s, &req, &headerLen);
	if (headerLen < 0) {
		free(req);
		return;
	}
	char method[8] = {0}, url[384] = {0};
	sscanf((char *)req, "%7s %383s", method, url);

	if (!strcmp(url, "/api/info")) {
		// Nombre de archivo solo con caracteres seguros para meterlo en el JSON.
		char file[96];
		const char *src = current->kind == SRC_SD ? baseName(current->path) : current->kind == SRC_NDS ? "cartucho.sav" : current->inner + 1;
		size_t j = 0;
		for (size_t i = 0; src[i] && j < sizeof(file) - 1; i++) {
			char c = src[i];
			file[j++] = (c >= 32 && c < 127 && c != '"' && c != '\\') ? c : '_';
		}
		file[j] = 0;
		char json[320];
		snprintf(json, sizeof(json), "{\"app\":\"PokeSave Link\",\"game\":\"%s\",\"label\":\"%s\",\"file\":\"%s\",\"size\":%lu}", current->code, current->label, file, (unsigned long)saveSize);
		replyText(s, "200 OK", json);
	} else if (!strcmp(url, "/api/save") && !strcmp(method, "GET")) {
		reply(s, "200 OK", "application/octet-stream", saveData, saveSize);
	} else if (!strcmp(url, "/api/save") && !strcmp(method, "POST")) {
		char *pinHeader = findHeader((char *)req, "\nX-PokeSave-Pin:");
		char given[8] = {0};
		if (pinHeader) sscanf(pinHeader + 16, " %7s", given);
		int bodyLen = len - headerLen;
		if (!pinHeader || strcmp(given, pin)) {
			replyText(s, "403 Forbidden", "{\"error\":\"pin\"}");
		} else if ((u32)bodyLen != saveSize) {
			replyText(s, "400 Bad Request", "{\"error\":\"size\"}");
		} else if (!backup("antes")) {
			replyText(s, "500 Internal Server Error", "{\"error\":\"backup\"}");
		} else {
			Result res = writeSave(current, req + headerLen, bodyLen);
			if (R_SUCCEEDED(res)) {
				memcpy(saveData, req + headerLen, bodyLen);
				printf("\x1b[32mPartida guardada en la 3DS.\x1b[0m\n");
				replyText(s, "200 OK", "{\"ok\":true}");
			} else {
				printf("\x1b[31mError al guardar: %08lX\x1b[0m\n", res);
				replyText(s, "500 Internal Server Error", "{\"error\":\"write\"}");
			}
		}
	} else if (!strcmp(method, "GET")) {
		serveFile(s, url);
	} else {
		replyText(s, "405 Method Not Allowed", "{\"error\":\"method\"}");
	}
	free(req);
}

// ---------- Pantalla ----------

/** Menú inicial: juegos de 3DS encontrados + "Buscar un .sav en la SD". Devuelve el índice
 *  (count = buscar en la SD) o -1 para salir. */
static int chooseGame(Found *found, int count) {
	int sel = 0, total = count + 1;
	bool redraw = true;
	while (aptMainLoop()) {
		if (redraw) {
			consoleClear();
			printf("\x1b[1;1H\x1b[31mPokeSave Link\x1b[0m\n\nElige la partida:\n\n");
			for (int i = 0; i < count; i++)
				printf("%s %.30s (%s)\n", i == sel ? "\x1b[33m>" : " ", found[i].label,
				       found[i].kind == SRC_NDS ? "cartucho DS" : !strcmp(found[i].inner, "/sav.dat") ? "Consola Virtual" : found[i].media == MEDIATYPE_GAME_CARD ? "cartucho" : "digital");
			if (count) printf("\x1b[0m\n");
			printf("%s Buscar un .sav en la SD...\x1b[0m\n", sel == count ? "\x1b[33m>" : " ");
			printf("   (juegos de DS con TWiLight, emuladores...)\n");
			printf("\nA: elegir   START: salir\n");
			redraw = false;
		}
		gspWaitForVBlank();
		hidScanInput();
		u32 k = hidKeysDown();
		if (k & KEY_START) return -1;
		if (k & KEY_DOWN) { sel = (sel + 1) % total; redraw = true; }
		if (k & KEY_UP) { sel = (sel + total - 1) % total; redraw = true; }
		if (k & KEY_A) return sel;
	}
	return -1;
}

// ---------- Explorador de la SD ----------

#define MAX_ENTRIES 512
#define LAST_DIR "sdmc:/3ds/PokeSave/ultima-carpeta.txt"
typedef struct {
	char name[128];
	bool dir;
	long size;
} Entry;
static Entry entries[MAX_ENTRIES];

static bool isSaveName(const char *name) {
	const char *ext = strrchr(name, '.');
	if (!ext) return false;
	return !strcasecmp(ext, ".sav") || !strcasecmp(ext, ".dsv") || !strcasecmp(ext, ".sv") || !strcasecmp(ext, ".srm") || !strcasecmp(ext, ".sa1");
}

static int cmpEntry(const void *a, const void *b) {
	const Entry *x = a, *y = b;
	if (x->dir != y->dir) return x->dir ? -1 : 1;
	return strcasecmp(x->name, y->name);
}

static int listDir(const char *dir) {
	int n = 0;
	DIR *d = opendir(dir);
	if (!d) return 0;
	struct dirent *e;
	while ((e = readdir(d)) && n < MAX_ENTRIES) {
		if (e->d_name[0] == '.') continue;
		char full[512];
		snprintf(full, sizeof(full), "%s/%s", strcmp(dir, "sdmc:/") ? dir : "sdmc:", e->d_name);
		struct stat st;
		if (stat(full, &st) != 0) continue;
		bool isDir = S_ISDIR(st.st_mode);
		if (!isDir && !isSaveName(e->d_name)) continue;
		snprintf(entries[n].name, sizeof(entries[n].name), "%.127s", e->d_name);
		entries[n].dir = isDir;
		entries[n].size = st.st_size;
		n++;
	}
	closedir(d);
	qsort(entries, n, sizeof(Entry), cmpEntry);
	return n;
}

static void parentDir(char *dir) {
	if (!strcmp(dir, "sdmc:/")) return;
	char *s = strrchr(dir, '/');
	if (s && s > dir + 5) *s = 0;
	else strcpy(dir, "sdmc:/");
}

/** Navega por la SD hasta elegir un .sav. Devuelve true y deja la ruta en out. */
static bool browseSd(char *out, size_t outSize) {
	char dir[384] = "sdmc:/";
	FILE *last = fopen(LAST_DIR, "r");
	if (last) {
		if (fgets(dir, sizeof(dir), last)) dir[strcspn(dir, "\r\n")] = 0;
		fclose(last);
		struct stat st;
		if (stat(dir, &st) != 0 || !S_ISDIR(st.st_mode)) strcpy(dir, "sdmc:/");
	}
	int n = listDir(dir), sel = 0, top = 0;
	const int rows = 22;
	bool redraw = true;
	while (aptMainLoop()) {
		if (redraw) {
			consoleClear();
			printf("\x1b[1;1H\x1b[31mElige tu partida (.sav)\x1b[0m\n\x1b[36m%.48s\x1b[0m\n\n", dir + 5);
			if (n == 0) printf("  (aqui no hay carpetas ni partidas)\n");
			if (sel < top) top = sel;
			if (sel >= top + rows) top = sel - rows + 1;
			for (int i = top; i < n && i < top + rows; i++) {
				if (entries[i].dir) printf("%s[%.40s]\x1b[0m\n", i == sel ? "\x1b[33m> " : "  ", entries[i].name);
				else printf("%s%.36s %5ldK\x1b[0m\n", i == sel ? "\x1b[33m> " : "  ", entries[i].name, entries[i].size / 1024);
			}
			printf("\x1b[29;1HA: abrir  B: atras  L/R: pagina  START: salir");
			redraw = false;
		}
		gspWaitForVBlank();
		hidScanInput();
		u32 k = hidKeysDown();
		if (k & KEY_START) return false;
		if (n && (k & KEY_DOWN)) { sel = (sel + 1) % n; redraw = true; }
		if (n && (k & KEY_UP)) { sel = (sel + n - 1) % n; redraw = true; }
		if (n && (k & (KEY_R | KEY_RIGHT))) { sel = sel + rows < n ? sel + rows : n - 1; redraw = true; }
		if (n && (k & (KEY_L | KEY_LEFT))) { sel = sel - rows > 0 ? sel - rows : 0; redraw = true; }
		if (k & KEY_B) {
			parentDir(dir);
			n = listDir(dir);
			sel = top = 0;
			redraw = true;
		}
		if (n && (k & KEY_A)) {
			char next[512];
			snprintf(next, sizeof(next), "%s/%s", strcmp(dir, "sdmc:/") ? dir : "sdmc:", entries[sel].name);
			if (entries[sel].dir) {
				snprintf(dir, sizeof(dir), "%.383s", next);
				n = listDir(dir);
				sel = top = 0;
				redraw = true;
			} else if (entries[sel].size <= 0 || entries[sel].size > MAX_SAVE) {
				printf("\x1b[28;1H\x1b[31mEse archivo no parece una partida.\x1b[0m");
			} else {
				snprintf(out, outSize, "%.383s", next);
				mkdirs("sdmc:/3ds/PokeSave");
				FILE *fp = fopen(LAST_DIR, "w");
				if (fp) {
					fputs(dir, fp);
					fclose(fp);
				}
				return true;
			}
		}
	}
	return false;
}

static void waitExit(void) {
	printf("\nPulsa START para salir.\n");
	while (aptMainLoop()) {
		hidScanInput();
		if (hidKeysDown() & KEY_START) break;
		gspWaitForVBlank();
	}
}

/** ¿Esta partida tiene ese archivo dentro? (y su tamaño, para descartar lo que no es). */
static bool titleHasFile(Found *f, const char *inner, u64 *size) {
	FS_Archive a;
	if (R_FAILED(openSaveArchive(f, &a))) return false;
	Handle h;
	bool ok = R_SUCCEEDED(FSUSER_OpenFile(&h, a, fsMakePath(PATH_ASCII, inner), FS_OPEN_READ, 0));
	if (ok) {
		FSFILE_GetSize(h, size);
		FSFILE_Close(h);
	}
	FSUSER_CloseArchive(a);
	return ok;
}

static int findSaves(Found *out, int max, bool pxi) {
	int n = 0;
	// 1. Juegos de 3DS conocidos, en cartucho y digitales.
	for (unsigned i = 0; i < GAME_COUNT && n < max; i++) {
		for (int m = 0; m < 2 && n < max; m++) {
			Found f = {0};
			f.kind = SRC_TITLE;
			f.game = &GAMES[i];
			f.id = GAMES[i].id;
			f.media = m == 0 ? MEDIATYPE_GAME_CARD : MEDIATYPE_SD;
			strcpy(f.inner, "/main");
			u64 size = 0;
			if (titleHasFile(&f, "/main", &size) && size > 0) {
				snprintf(f.code, sizeof(f.code), "%s", GAMES[i].code);
				snprintf(f.label, sizeof(f.label), "%s", GAMES[i].name);
				out[n++] = f;
			}
		}
	}
	// 2. Consola Virtual: títulos instalados cuya partida es un "sav.dat" del tamaño de una de
	//    Game Boy (32-64 KB). PKHeX dirá luego si es de Pokémon.
	u32 total = 0;
	if (R_SUCCEEDED(AM_GetTitleCount(MEDIATYPE_SD, &total)) && total > 0) {
		u64 *ids = malloc(total * sizeof(u64));
		u32 read = 0;
		if (ids && R_SUCCEEDED(AM_GetTitleList(&read, MEDIATYPE_SD, total, ids))) {
			for (u32 i = 0; i < read && n < max; i++) {
				if ((ids[i] >> 32) != 0x00040000) continue; // solo aplicaciones
				Found f = {0};
				f.kind = SRC_TITLE;
				f.id = ids[i];
				f.media = MEDIATYPE_SD;
				strcpy(f.inner, "/sav.dat");
				u64 size = 0;
				if (!titleHasFile(&f, "/sav.dat", &size) || size < 0x2000 || size > 0x20000) continue;
				char product[16] = {0};
				AM_GetTitleProductCode(MEDIATYPE_SD, ids[i], product);
				strcpy(f.code, "VC");
				snprintf(f.label, sizeof(f.label), "VC %.15s", product[0] ? product : "?");
				out[n++] = f;
			}
		}
		free(ids);
	}
	// 3. Cartucho de DS metido en la consola.
	bool inserted = false;
	FS_CardType card;
	if (pxi && n < max && R_SUCCEEDED(FSUSER_CardSlotIsInserted(&inserted)) && inserted && R_SUCCEEDED(FSUSER_GetCardType(&card)) && card == CARD_TWL) {
		u8 *header = malloc(0x3B4);
		if (header && R_SUCCEEDED(FSUSER_GetLegacyRomHeader(MEDIATYPE_GAME_CARD, 0LL, header))) {
			char gameCode[5] = {0};
			memcpy(gameCode, header + 12, 4);
			for (unsigned i = 0; i < sizeof(DS_GAMES) / sizeof(DS_GAMES[0]); i++) {
				if (strncmp(gameCode, DS_GAMES[i].prefix, 3)) continue;
				Found f = {0};
				f.kind = SRC_NDS;
				if (R_SUCCEEDED(spiGetCardType(&f.spi, gameCode[0] == 'I')) && spiCapacity(f.spi) == 512 * 1024) {
					f.spiSize = 512 * 1024;
					snprintf(f.code, sizeof(f.code), "%s", DS_GAMES[i].code);
					snprintf(f.label, sizeof(f.label), "%s", DS_GAMES[i].name);
					out[n++] = f;
				} else {
					printf("\x1b[33mCartucho %s: no se reconoce su memoria.\x1b[0m\n", gameCode);
				}
				break;
			}
		}
		free(header);
	}
	return n;
}

int main(void) {
	gfxInitDefault();
	consoleInit(GFX_TOP, NULL);

	printf("\x1b[31mPokeSave Link\x1b[0m\n\nBuscando partidas...\n");
	amInit();
	bool pxi = R_SUCCEEDED(pxiDevInit());
	static Found found[48];
	int count = findSaves(found, 48, pxi);
	int sel = chooseGame(found, count);
	if (sel < 0) {
		if (pxi) pxiDevExit();
		amExit();
		gfxExit();
		return 0;
	}
	static Found sdFile;
	if (sel == count) {
		memset(&sdFile, 0, sizeof(sdFile));
		sdFile.kind = SRC_SD;
		if (!browseSd(sdFile.path, sizeof(sdFile.path))) {
			gfxExit();
			return 0;
		}
		strcpy(sdFile.code, "SD");
		snprintf(sdFile.label, sizeof(sdFile.label), "%.63s", baseName(sdFile.path));
		current = &sdFile;
	} else {
		current = &found[sel];
	}
	consoleClear();
	printf("\x1b[31mPokeSave Link\x1b[0m - %.40s\n\n", current->label);
	if (current->kind == SRC_NDS) printf("Cartucho de DS: no lo saques mientras\nesta app este abierta.\n\n");

	if (R_FAILED(readSave(current))) {
		printf("No se ha podido leer la partida.\n");
		waitExit();
		gfxExit();
		return 0;
	}
	if (!backup("original")) printf("\x1b[33mAviso: no se ha podido hacer la copia en la SD.\x1b[0m\n");

	srand((unsigned)osGetTime());
	snprintf(pin, sizeof(pin), "%04u", (unsigned)(rand() % 10000));

	socBuffer = memalign(SOC_ALIGN, SOC_BUFFERSIZE);
	if (!socBuffer || socInit(socBuffer, SOC_BUFFERSIZE) != 0) {
		printf("No se ha podido iniciar la red.\n");
		waitExit();
		gfxExit();
		return 0;
	}
	int server = socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
	struct sockaddr_in addr = {0};
	addr.sin_family = AF_INET;
	addr.sin_port = htons(PORT);
	addr.sin_addr.s_addr = gethostid();
	if (server < 0 || bind(server, (struct sockaddr *)&addr, sizeof(addr)) != 0 || listen(server, 4) != 0) {
		printf("No se ha podido abrir el puerto %d.\n", PORT);
		waitExit();
		socExit();
		gfxExit();
		return 0;
	}
	fcntl(server, F_SETFL, fcntl(server, F_GETFL, 0) | O_NONBLOCK);

	struct in_addr ip = {.s_addr = gethostid()};
	printf("Abre en el movil o el PC (misma wifi):\n\n  \x1b[36mhttp://%s:%d\x1b[0m\n\n", inet_ntoa(ip), PORT);
	printf("PIN para guardar: \x1b[33m%s\x1b[0m\n\n", pin);
	printf("Copias en sdmc:/3ds/PokeSave/backups/\n");
	printf("START: salir y abrir el juego\n\n");

	while (aptMainLoop()) {
		hidScanInput();
		if (hidKeysDown() & KEY_START) break;
		struct sockaddr_in client;
		socklen_t clen = sizeof(client);
		int c = accept(server, (struct sockaddr *)&client, &clen);
		if (c >= 0) {
			fcntl(c, F_SETFL, fcntl(c, F_GETFL, 0) & ~O_NONBLOCK);
			handle(c);
			close(c);
		} else {
			gspWaitForVBlank();
		}
	}

	close(server);
	socExit();
	free(saveData);
	if (pxi) pxiDevExit();
	amExit();
	gfxExit();
	return 0;
}
