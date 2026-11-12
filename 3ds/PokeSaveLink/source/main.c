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
#include <math.h>
#include <citro2d.h>
#include "qrcodegen.h"
#include "spi.h"

#define PORT 8000
#define APP_VERSION "1.0"
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
static const char *webRoot = "sdmc:/3ds/PokeSave/web";

// Estado que enseña la pantalla (lo actualiza el hilo del servidor).
static volatile int serveStatus; // 0 esperando, 1 web abierta, 2 partida enviada, 3 guardando, 4 guardada, 5 error
static volatile u32 savedAt;
static volatile u32 frameNo;
static char lastLog[96] = "Copia de seguridad hecha en la SD";
static void addLog(const char *msg) { snprintf(lastLog, sizeof(lastLog), "%s", msg); }

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
	snprintf(path, sizeof(path), "%s%.*s", webRoot, len, urlPath);
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
		serveStatus = 2;
		addLog("Edita en el navegador y pulsa Guardar en la 3DS");
	} else if (!strcmp(url, "/api/save") && !strcmp(method, "POST")) {
		char *pinHeader = findHeader((char *)req, "\nX-PokeSave-Pin:");
		char given[8] = {0};
		if (pinHeader) sscanf(pinHeader + 16, " %7s", given);
		int bodyLen = len - headerLen;
		if (!pinHeader || strcmp(given, pin)) {
			replyText(s, "403 Forbidden", "{\"error\":\"pin\"}");
		} else if ((u32)bodyLen != saveSize) {
			replyText(s, "400 Bad Request", "{\"error\":\"size\"}");
		} else if ((serveStatus = 3), !backup("antes")) {
			replyText(s, "500 Internal Server Error", "{\"error\":\"backup\"}");
		} else {
			Result res = writeSave(current, req + headerLen, bodyLen);
			if (R_SUCCEEDED(res)) {
				memcpy(saveData, req + headerLen, bodyLen);
				serveStatus = 4;
				savedAt = frameNo;
				addLog("Hay otra copia de lo de antes en la SD");
				replyText(s, "200 OK", "{\"ok\":true}");
			} else {
				serveStatus = 5;
				char m[96];
				snprintf(m, sizeof(m), "Error %08lX. Tienes la copia en la SD.", res);
				addLog(m);
				replyText(s, "500 Internal Server Error", "{\"error\":\"write\"}");
			}
		}
	} else if (!strcmp(method, "GET")) {
		if (serveStatus == 0 && (!strcmp(url, "/") || !strncmp(url, "/index.html", 11))) {
			serveStatus = 1;
			addLog("Toca Abrir la partida de la 3DS");
		}
		serveFile(s, url);
	} else {
		replyText(s, "405 Method Not Allowed", "{\"error\":\"method\"}");
	}
	free(req);
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
					(void)gameCode;
				}
				break;
			}
		}
		free(header);
	}
	return n;
}


// ======================================================================
//  Interfaz (citro2d): las dos pantallas, con tarjetas, iconos, QR y animaciones.
// ======================================================================

#define C_NAVY C2D_Color32(14, 20, 48, 255)
#define C_NAVY2 C2D_Color32(24, 33, 80, 255)
#define C_NAVY3 C2D_Color32(36, 48, 110, 255)
#define C_LINE C2D_Color32(58, 67, 128, 255)
#define C_RED C2D_Color32(227, 36, 43, 255)
#define C_RED_HI C2D_Color32(255, 80, 84, 255)
#define C_RED_LO C2D_Color32(158, 15, 27, 255)
#define C_GOLD C2D_Color32(255, 203, 5, 255)
#define C_TEXT C2D_Color32(243, 245, 255, 255)
#define C_MUTED C2D_Color32(168, 176, 214, 255)
#define C_GOOD C2D_Color32(61, 220, 132, 255)
#define C_BAD C2D_Color32(255, 90, 90, 255)
#define C_LCD C2D_Color32(155, 188, 15, 255)
#define C_LCD_INK C2D_Color32(31, 59, 18, 255)
#define C_WHITE C2D_Color32(255, 255, 255, 255)
#define C_BLUE C2D_Color32(41, 168, 255, 255)

static C2D_TextBuf textBuf;
static C2D_SpriteSheet sheet;

static void rrect(float x, float y, float w, float h, float r, u32 c) {
	if (r * 2 > h) r = h / 2;
	if (r * 2 > w) r = w / 2;
	C2D_DrawRectSolid(x + r, y, 0, w - 2 * r, h, c);
	C2D_DrawRectSolid(x, y + r, 0, r, h - 2 * r, c);
	C2D_DrawRectSolid(x + w - r, y + r, 0, r, h - 2 * r, c);
	C2D_DrawCircleSolid(x + r, y + r, 0, r, c);
	C2D_DrawCircleSolid(x + w - r, y + r, 0, r, c);
	C2D_DrawCircleSolid(x + r, y + h - r, 0, r, c);
	C2D_DrawCircleSolid(x + w - r, y + h - r, 0, r, c);
}

/** Texto con la fuente del sistema (lleva tildes y ñ). size 1.0 ≈ 30 px. */
static float txt(const char *s, float x, float y, float size, u32 c, u32 flags) {
	C2D_Text t;
	C2D_TextParse(&t, textBuf, s);
	C2D_TextOptimize(&t);
	C2D_DrawText(&t, C2D_WithColor | flags, x, y, 0.5f, size, size, c);
	float w = 0, h = 0;
	C2D_TextGetDimensions(&t, size, size, &w, &h);
	return w;
}

static void logo(float x, float y, float scale) {
	if (sheet) C2D_DrawImageAt(C2D_SpriteSheetGetImage(sheet, 0), x, y, 0.5f, NULL, scale, scale);
}

/** Poké Ball girando (cargando). */
static void spinner(float cx, float cy, float r) {
	for (int i = 0; i < 8; i++) {
		float a = (frameNo * 0.15f) + i * (M_PI * 2 / 8);
		u8 alpha = 60 + i * 24;
		C2D_DrawCircleSolid(cx + cosf(a) * r, cy + sinf(a) * r, 0, r * 0.22f, C2D_Color32(255, 203, 5, alpha));
	}
}

static void background(float w, float h) {
	C2D_DrawRectangle(0, 0, 0, w, h, C_NAVY3, C_NAVY3, C_NAVY, C_NAVY);
	// franjas diagonales que se mueven
	float off = (frameNo % 120) * 1.0f;
	u32 c = C2D_Color32(255, 255, 255, 12);
	for (float x = -240 + off; x < w + 240; x += 60) C2D_DrawTriangle(x, 0, c, x + 22, 0, c, x - 140, h, c, 0), C2D_DrawTriangle(x + 22, 0, c, x - 118, h, c, x - 140, h, c, 0);
}

static void header(const char *right) {
	C2D_DrawRectangle(0, 0, 0, 400, 40, C_RED_HI, C_RED_HI, C_RED_LO, C_RED_LO);
	C2D_DrawRectSolid(0, 40, 0, 400, 3, C2D_Color32(0, 0, 0, 70));
	logo(8, 4, 0.5f);
	txt("PokeSave", 46, 6, 0.72f, C_WHITE, 0);
	txt("LINK", 160, 13, 0.5f, C_GOLD, 0);
	if (right) txt(right, 392, 13, 0.45f, C2D_Color32(255, 225, 225, 255), C2D_AlignRight);
}

/** Etiqueta de color con el tipo de partida (3DS, VC, DS, SD). */
static void badge(float x, float y, const char *label, u32 color) {
	rrect(x, y, 40, 24, 8, color);
	txt(label, x + 20, y + 4, 0.48f, C_WHITE, C2D_AlignCenter);
}

static void kindBadge(const Found *f, float x, float y) {
	if (f->kind == SRC_NDS) badge(x, y, "DS", C_BLUE);
	else if (f->kind == SRC_SD) badge(x, y, "SD", C2D_Color32(214, 160, 0, 255));
	else if (!strcmp(f->inner, "/sav.dat")) badge(x, y, "VC", C2D_Color32(40, 170, 90, 255));
	else badge(x, y, "3DS", C_RED);
}

static const char *kindText(const Found *f) {
	if (f->kind == SRC_NDS) return "Cartucho de DS";
	if (f->kind == SRC_SD) return "Archivo de la SD";
	if (!strcmp(f->inner, "/sav.dat")) return "Consola Virtual";
	return f->media == MEDIATYPE_GAME_CARD ? "Cartucho de 3DS" : "Juego digital";
}

/** Cruceta dibujada (la fuente del sistema no tiene flechas). */
static void dpad(float cx, float cy, float s, u32 c) {
	C2D_DrawRectSolid(cx - s / 6, cy - s / 2, 0, s / 3, s, c);
	C2D_DrawRectSolid(cx - s / 2, cy - s / 6, 0, s, s / 3, c);
}

/** Marca de "hecho" dibujada. */
static void checkMark(float cx, float cy, float s, u32 c) {
	C2D_DrawLine(cx - s * 0.45f, cy, c, cx - s * 0.1f, cy + s * 0.35f, c, s * 0.22f, 0);
	C2D_DrawLine(cx - s * 0.12f, cy + s * 0.35f, c, cx + s * 0.5f, cy - s * 0.35f, c, s * 0.22f, 0);
}

/** Botón dibujado con la letra de la consola ("A", "B"…); "+" dibuja la cruceta. */
static float keyHint(float x, float y, const char *key, const char *label, u32 color) {
	if (!strcmp(key, "+")) {
		rrect(x, y, 22, 22, 11, color);
		dpad(x + 11, y + 11, 14, C_WHITE);
		return 28 + txt(label, x + 28, y + 3, 0.45f, C_TEXT, 0) + 16;
	}
	float kw = strlen(key) > 1 ? 44 : 22;
	rrect(x, y, kw, 22, 11, color);
	txt(key, x + kw / 2, y + 3, 0.45f, C_WHITE, C2D_AlignCenter);
	return kw + 6 + txt(label, x + kw + 6, y + 3, 0.45f, C_TEXT, 0) + 16;
}

// ---------- estado de la app ----------

typedef enum { ST_MENU, ST_BROWSE, ST_LOADING, ST_SERVE, ST_ERROR } AppState;

static Found found[48];
static int foundCount;
static Found sdFile;
static int menuSel;
static char errorMsg[160];

// explorador
static char browseDir[384] = "sdmc:/";
static int browseN, browseSel, browseTop;

// servidor (lo comparten el hilo del servidor y la pantalla)
static volatile bool serverRun;
static char url[64];
static u8 qr[qrcodegen_BUFFER_LEN_FOR_VERSION(6)];
static bool qrOk;
static int serverSock = -1;
static Thread serverThread;

static void serverMain(void *arg) {
	(void)arg;
	while (serverRun) {
		struct sockaddr_in client;
		socklen_t clen = sizeof(client);
		int c = accept(serverSock, (struct sockaddr *)&client, &clen);
		if (c >= 0) {
			fcntl(c, F_SETFL, fcntl(c, F_GETFL, 0) & ~O_NONBLOCK);
			handle(c);
			close(c);
		} else {
			svcSleepThread(10 * 1000000LL);
		}
	}
}

static void loadBrowse(void) {
	browseN = listDir(browseDir);
	browseSel = browseTop = 0;
}

static void openBrowser(void) {
	FILE *last = fopen(LAST_DIR, "r");
	strcpy(browseDir, "sdmc:/");
	if (last) {
		if (fgets(browseDir, sizeof(browseDir), last)) browseDir[strcspn(browseDir, "\r\n")] = 0;
		fclose(last);
		struct stat st;
		if (stat(browseDir, &st) != 0 || !S_ISDIR(st.st_mode)) strcpy(browseDir, "sdmc:/");
	}
	loadBrowse();
}

/** Lee la partida, hace la copia y arranca el servidor. Devuelve false con errorMsg. */
static bool startServing(void) {
	if (R_FAILED(readSave(current))) {
		snprintf(errorMsg, sizeof(errorMsg), "No se ha podido leer la partida.");
		return false;
	}
	if (!backup("original")) addLog("Aviso: no se ha podido hacer la copia");
	srand((unsigned)osGetTime());
	snprintf(pin, sizeof(pin), "%04u", (unsigned)(rand() % 10000));

	socBuffer = memalign(SOC_ALIGN, SOC_BUFFERSIZE);
	if (!socBuffer || socInit(socBuffer, SOC_BUFFERSIZE) != 0) {
		snprintf(errorMsg, sizeof(errorMsg), "No se ha podido iniciar la red.");
		return false;
	}
	u32 ip = gethostid();
	if (ip == 0) {
		snprintf(errorMsg, sizeof(errorMsg), "La consola no está conectada a ninguna wifi.");
		return false;
	}
	serverSock = socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
	struct sockaddr_in addr = {0};
	addr.sin_family = AF_INET;
	addr.sin_port = htons(PORT);
	addr.sin_addr.s_addr = ip;
	if (serverSock < 0 || bind(serverSock, (struct sockaddr *)&addr, sizeof(addr)) != 0 || listen(serverSock, 4) != 0) {
		snprintf(errorMsg, sizeof(errorMsg), "No se ha podido abrir el puerto %d.", PORT);
		return false;
	}
	fcntl(serverSock, F_SETFL, fcntl(serverSock, F_GETFL, 0) | O_NONBLOCK);
	struct in_addr in = {.s_addr = ip};
	snprintf(url, sizeof(url), "http://%s:%d", inet_ntoa(in), PORT);
	u8 tmp[qrcodegen_BUFFER_LEN_FOR_VERSION(6)];
	qrOk = qrcodegen_encodeText(url, tmp, qr, qrcodegen_Ecc_MEDIUM, 1, 6, qrcodegen_Mask_AUTO, true);

	serverRun = true;
	s32 prio = 0x30;
	svcGetThreadPriority(&prio, CUR_THREAD_HANDLE);
	serverThread = threadCreate(serverMain, NULL, 64 * 1024, prio - 1, -1, false);
	return true;
}

// ---------- pantallas ----------

static void drawMenu(C3D_RenderTarget *top, C3D_RenderTarget *bottom) {
	C2D_SceneBegin(top);
	background(400, 240);
	header("Elige tu partida");
	int total = foundCount + 1;
	const float cardH = 52, gap = 6, y0 = 52;
	int visible = 3;
	int first = menuSel - 1 < 0 ? 0 : menuSel - 1;
	if (first > total - visible) first = total - visible < 0 ? 0 : total - visible;
	for (int i = first; i < total && i < first + visible; i++) {
		float y = y0 + (i - first) * (cardH + gap);
		bool sel = i == menuSel;
		float pulse = sel ? (sinf(frameNo * 0.12f) + 1) * 1.5f : 0;
		if (sel) rrect(10 - pulse, y - 2 - pulse, 380 + pulse * 2, cardH + 4 + pulse * 2, 14, C_GOLD);
		rrect(12, y, 376, cardH, 12, sel ? C_NAVY3 : C_NAVY2);
		if (i < foundCount) {
			kindBadge(&found[i], 24, y + 14);
			txt(found[i].label, 76, y + 7, 0.62f, C_TEXT, 0);
			txt(kindText(&found[i]), 76, y + 29, 0.46f, C_MUTED, 0);
		} else {
			badge(24, y + 14, "SD", C2D_Color32(214, 160, 0, 255));
			txt("Buscar un .sav en la SD", 76, y + 7, 0.62f, C_TEXT, 0);
			txt("TWiLight Menu++, emuladores, copias...", 76, y + 29, 0.46f, C_MUTED, 0);
		}
		if (sel) txt(">", 372, y + 14, 0.7f, C_GOLD, C2D_AlignRight);
	}
	if (total > visible) {
		// barra de desplazamiento
		float h = 170.0f * visible / total, y = 52 + (170.0f - h) * first / (total - visible);
		rrect(392, 52, 4, 170, 2, C_LINE);
		rrect(392, y, 4, h, 2, C_GOLD);
	}

	C2D_SceneBegin(bottom);
	C2D_DrawRectangle(0, 0, 0, 320, 240, C_NAVY2, C_NAVY2, C_NAVY, C_NAVY);
	logo(128, 18, 1.0f);
	txt("Edita tu partida desde el", 160, 92, 0.55f, C_TEXT, C2D_AlignCenter);
	txt("navegador del móvil o del PC", 160, 112, 0.55f, C_TEXT, C2D_AlignCenter);
	rrect(20, 144, 280, 44, 12, C_NAVY3);
	txt("Siempre se hace una copia antes de", 160, 150, 0.45f, C_MUTED, C2D_AlignCenter);
	txt("guardar en sdmc:/3ds/PokeSave/backups/", 160, 167, 0.45f, C_MUTED, C2D_AlignCenter);
	float x = 26;
	x += keyHint(x, 204, "A", "Elegir", C_RED);
	x += keyHint(x, 204, "+", "Moverse", C_LINE);
	keyHint(x, 204, "START", "Salir", C_LINE);
	txt("v" APP_VERSION, 314, 230, 0.36f, C_MUTED, C2D_AlignRight);
}

static void drawBrowse(C3D_RenderTarget *top, C3D_RenderTarget *bottom) {
	C2D_SceneBegin(top);
	background(400, 240);
	header("Elige el .sav");
	rrect(8, 46, 384, 20, 8, C_NAVY);
	char path[64];
	const char *p = browseDir + 5;
	size_t len = strlen(p);
	snprintf(path, sizeof(path), "%s%s", len > 52 ? "..." : "", len > 52 ? p + len - 52 : p);
	txt(path, 16, 48, 0.45f, C_BLUE, 0);
	const int rows = 7;
	if (browseSel < browseTop) browseTop = browseSel;
	if (browseSel >= browseTop + rows) browseTop = browseSel - rows + 1;
	if (browseN == 0) txt("Aquí no hay carpetas ni partidas", 200, 130, 0.55f, C_MUTED, C2D_AlignCenter);
	for (int i = browseTop; i < browseN && i < browseTop + rows; i++) {
		float y = 72 + (i - browseTop) * 24;
		bool sel = i == browseSel;
		if (sel) rrect(8, y, 384, 22, 8, C_NAVY3), rrect(8, y, 4, 22, 2, C_GOLD);
		if (entries[i].dir) {
			C2D_DrawRectSolid(20, y + 5, 0, 8, 4, C_GOLD);
			rrect(20, y + 7, 18, 11, 2, C_GOLD);
		} else {
			rrect(22, y + 3, 14, 17, 2, C_WHITE);
			C2D_DrawRectSolid(22, y + 14, 0, 14, 6, C_BLUE);
		}
		txt(entries[i].name, 46, y + 3, 0.5f, sel ? C_WHITE : C_TEXT, 0);
		if (!entries[i].dir) {
			char kb[16];
			snprintf(kb, sizeof(kb), "%ld KB", entries[i].size / 1024);
			txt(kb, 384, y + 4, 0.45f, C_MUTED, C2D_AlignRight);
		}
	}

	C2D_SceneBegin(bottom);
	C2D_DrawRectangle(0, 0, 0, 320, 240, C_NAVY2, C_NAVY2, C_NAVY, C_NAVY);
	if (browseN > 0) {
		Entry *e = &entries[browseSel];
		rrect(14, 16, 292, 96, 16, C_NAVY3);
		txt(e->dir ? "Carpeta" : "Partida", 30, 26, 0.48f, C_GOLD, 0);
		txt(e->name, 30, 48, 0.55f, C_TEXT, 0);
		if (!e->dir) {
			char kb[32];
			snprintf(kb, sizeof(kb), "%ld KB", e->size / 1024);
			txt(kb, 30, 76, 0.5f, C_MUTED, 0);
		} else {
			txt("Pulsa A para entrar", 30, 76, 0.5f, C_MUTED, 0);
		}
	}
	txt("Juegos de DS con TWiLight: busca", 160, 126, 0.45f, C_MUTED, C2D_AlignCenter);
	txt("en la carpeta \"saves\" junto a la ROM.", 160, 143, 0.45f, C_MUTED, C2D_AlignCenter);
	float x = 14;
	x += keyHint(x, 176, "A", "Abrir", C_RED);
	x += keyHint(x, 176, "B", "Atrás", C_LINE);
	keyHint(x, 176, "L/R", "Página", C_LINE);
	keyHint(14, 206, "START", "Volver al menú", C_LINE);
}

static void drawLoading(C3D_RenderTarget *top, C3D_RenderTarget *bottom) {
	C2D_SceneBegin(top);
	background(400, 240);
	header(NULL);
	spinner(200, 120, 26);
	txt("Leyendo la partida...", 200, 170, 0.6f, C_TEXT, C2D_AlignCenter);
	if (current && current->kind == SRC_NDS) txt("No saques el cartucho", 200, 196, 0.5f, C_GOLD, C2D_AlignCenter);
	C2D_SceneBegin(bottom);
	C2D_DrawRectangle(0, 0, 0, 320, 240, C_NAVY2, C_NAVY2, C_NAVY, C_NAVY);
	logo(128, 88, 1.0f);
}

static void drawServe(C3D_RenderTarget *top, C3D_RenderTarget *bottom) {
	C2D_SceneBegin(top);
	background(400, 240);
	header(current->kind == SRC_NDS ? "No saques el cartucho" : "Conectado a la wifi");
	// tarjeta del juego
	rrect(10, 48, 380, 48, 12, C_NAVY2);
	kindBadge(current, 20, 60);
	txt(current->label, 70, 52, 0.6f, C_TEXT, 0);
	txt(kindText(current), 70, 74, 0.45f, C_MUTED, 0);
	// dirección y PIN
	txt("Abre en el navegador (misma wifi):", 14, 104, 0.48f, C_MUTED, 0);
	txt(url, 14, 122, 0.7f, C_GOLD, 0);
	rrect(270, 102, 120, 50, 10, C_LCD_INK);
	rrect(273, 105, 114, 44, 8, C_LCD);
	txt("PIN", 330, 106, 0.38f, C_LCD_INK, C2D_AlignCenter);
	txt(pin, 330, 118, 0.78f, C_LCD_INK, C2D_AlignCenter);
	// estado
	rrect(10, 162, 380, 68, 12, C_NAVY2);
	int st = serveStatus;
	const char *msg = st == 0 ? "Esperando al móvil o al PC..." : st == 1 ? "Web abierta en el navegador" : st == 2 ? "Partida enviada: ¡a editar!" : st == 3 ? "Guardando..." : st == 4 ? "¡Partida guardada y comprobada!" : "Error al guardar";
	u32 col = st == 4 ? C_GOOD : st == 5 ? C_BAD : C_TEXT;
	if (st == 0 || st == 3) spinner(34, 196, 10);
	else if (st == 4) C2D_DrawCircleSolid(34, 196, 0, 12 + sinf(frameNo * 0.3f) * (frameNo - savedAt < 30 ? 3 : 0), C_GOOD), checkMark(34, 196, 14, C_WHITE);
	else C2D_DrawCircleSolid(34, 196, 0, 10, st == 5 ? C_BAD : C_BLUE);
	txt(msg, 56, 172, 0.58f, col, 0);
	txt(st == 4 ? "Pulsa START y abre el juego" : lastLog, 56, 198, 0.45f, C_MUTED, 0);

	C2D_SceneBegin(bottom);
	C2D_DrawRectangle(0, 0, 0, 320, 240, C_NAVY2, C_NAVY2, C_NAVY, C_NAVY);
	if (qrOk) {
		int n = qrcodegen_getSize(qr);
		int scale = 170 / (n + 4);
		float size = scale * (n + 4), x0 = (320 - size) / 2, y0 = 12;
		rrect(x0 - 4, y0 - 4, size + 8, size + 8, 10, C_WHITE);
		for (int y = 0; y < n; y++)
			for (int x = 0; x < n; x++)
				if (qrcodegen_getModule(qr, x, y)) C2D_DrawRectSolid(x0 + (x + 2) * scale, y0 + (y + 2) * scale, 0, scale, scale, C_NAVY);
		txt("Escanéalo con el móvil o escribe la", 160, y0 + size + 8, 0.45f, C_TEXT, C2D_AlignCenter);
		txt("dirección en el navegador del PC", 160, y0 + size + 24, 0.45f, C_TEXT, C2D_AlignCenter);
	}
	keyHint(100, 214, "START", "Salir", C_LINE);
}

static void drawError(C3D_RenderTarget *top, C3D_RenderTarget *bottom) {
	C2D_SceneBegin(top);
	background(400, 240);
	header(NULL);
	rrect(20, 70, 360, 100, 16, C_RED_LO);
	txt("Algo ha fallado", 200, 84, 0.7f, C_WHITE, C2D_AlignCenter);
	txt(errorMsg, 200, 124, 0.5f, C2D_Color32(255, 225, 225, 255), C2D_AlignCenter);
	C2D_SceneBegin(bottom);
	C2D_DrawRectangle(0, 0, 0, 320, 240, C_NAVY2, C_NAVY2, C_NAVY, C_NAVY);
	txt("Tu partida no se ha tocado.", 160, 90, 0.55f, C_TEXT, C2D_AlignCenter);
	keyHint(110, 200, "START", "Salir", C_LINE);
}

int main(void) {
	gfxInitDefault();
	romfsInit();
	C3D_Init(C3D_DEFAULT_CMDBUF_SIZE);
	C2D_Init(C2D_DEFAULT_MAX_OBJECTS * 4);
	C2D_Prepare();
	C3D_RenderTarget *top = C2D_CreateScreenTarget(GFX_TOP, GFX_LEFT);
	C3D_RenderTarget *bottom = C2D_CreateScreenTarget(GFX_BOTTOM, GFX_LEFT);
	textBuf = C2D_TextBufNew(8192);
	sheet = C2D_SpriteSheetLoad("romfs:/gfx/sprites.t3x");
	struct stat st;
	webRoot = stat("romfs:/web/index.html", &st) == 0 ? "romfs:/web" : WEB_ROOT;

	hidSetRepeatParameters(18, 5); // mantener pulsado para bajar rápido por las listas
	amInit();
	bool pxi = R_SUCCEEDED(pxiDevInit());
	foundCount = findSaves(found, 48, pxi);

	AppState state = ST_MENU;
	bool startNow = false;
	while (aptMainLoop()) {
		hidScanInput();
		u32 k = hidKeysDown();
		u32 held = hidKeysDownRepeat();
		frameNo++;

		if (state == ST_MENU) {
			int total = foundCount + 1;
			if (held & KEY_DOWN) menuSel = (menuSel + 1) % total;
			if (held & KEY_UP) menuSel = (menuSel + total - 1) % total;
			if (k & KEY_START) break;
			if (k & KEY_A) {
				if (menuSel == foundCount) {
					openBrowser();
					state = ST_BROWSE;
				} else {
					current = &found[menuSel];
					state = ST_LOADING;
					startNow = true;
				}
			}
		} else if (state == ST_BROWSE) {
			const int rows = 7;
			if (browseN && (held & KEY_DOWN)) browseSel = (browseSel + 1) % browseN;
			if (browseN && (held & KEY_UP)) browseSel = (browseSel + browseN - 1) % browseN;
			if (browseN && (held & (KEY_R | KEY_RIGHT))) browseSel = browseSel + rows < browseN ? browseSel + rows : browseN - 1;
			if (browseN && (held & (KEY_L | KEY_LEFT))) browseSel = browseSel - rows > 0 ? browseSel - rows : 0;
			if (k & KEY_START) state = ST_MENU;
			if (k & KEY_B) {
				if (!strcmp(browseDir, "sdmc:/")) state = ST_MENU;
				else parentDir(browseDir), loadBrowse();
			}
			if (browseN && (k & KEY_A)) {
				char next[512];
				snprintf(next, sizeof(next), "%s/%s", strcmp(browseDir, "sdmc:/") ? browseDir : "sdmc:", entries[browseSel].name);
				if (entries[browseSel].dir) {
					snprintf(browseDir, sizeof(browseDir), "%.383s", next);
					loadBrowse();
				} else if (entries[browseSel].size > 0 && entries[browseSel].size <= MAX_SAVE) {
					memset(&sdFile, 0, sizeof(sdFile));
					sdFile.kind = SRC_SD;
					snprintf(sdFile.path, sizeof(sdFile.path), "%.383s", next);
					strcpy(sdFile.code, "SD");
					snprintf(sdFile.label, sizeof(sdFile.label), "%.63s", baseName(sdFile.path));
					mkdirs("sdmc:/3ds/PokeSave");
					FILE *fp = fopen(LAST_DIR, "w");
					if (fp) fputs(browseDir, fp), fclose(fp);
					current = &sdFile;
					state = ST_LOADING;
					startNow = true;
				}
			}
		} else if (state == ST_SERVE || state == ST_ERROR) {
			if (k & KEY_START) break;
		}

		C3D_FrameBegin(C3D_FRAME_SYNCDRAW);
		C2D_TextBufClear(textBuf);
		C2D_TargetClear(top, C_NAVY);
		C2D_TargetClear(bottom, C_NAVY);
		if (state == ST_MENU) drawMenu(top, bottom);
		else if (state == ST_BROWSE) drawBrowse(top, bottom);
		else if (state == ST_LOADING) drawLoading(top, bottom);
		else if (state == ST_SERVE) drawServe(top, bottom);
		else drawError(top, bottom);
		C3D_FrameEnd(0);

		// La lectura bloquea: se hace después de pintar una vez la pantalla de "Leyendo...".
		if (state == ST_LOADING && startNow) {
			startNow = false;
			state = startServing() ? ST_SERVE : ST_ERROR;
		}
	}

	if (serverRun) {
		serverRun = false;
		threadJoin(serverThread, U64_MAX);
		threadFree(serverThread);
	}
	if (serverSock >= 0) close(serverSock);
	if (socBuffer) socExit();
	free(saveData);
	if (pxi) pxiDevExit();
	amExit();
	if (sheet) C2D_SpriteSheetFree(sheet);
	C2D_TextBufDelete(textBuf);
	C2D_Fini();
	C3D_Fini();
	romfsExit();
	gfxExit();
	return 0;
}
