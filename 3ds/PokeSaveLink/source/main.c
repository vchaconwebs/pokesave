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
// API (mismo origen que la web):
//   GET  /api/info  → {"app":"PokeSave Link","game":"X","size":415232}
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

typedef struct {
	const Game *game;
	FS_MediaType media;
} Found;

static u32 *socBuffer;
static u8 *saveData;
static u32 saveSize;
static const Found *current;
static char pin[8];

// ---------- Partida ----------

static Result openSaveArchive(const Found *f, FS_Archive *archive) {
	u32 path[3] = {f->media, (u32)(f->game->id & 0xFFFFFFFF), (u32)(f->game->id >> 32)};
	return FSUSER_OpenArchive(archive, ARCHIVE_USER_SAVEDATA, (FS_Path){PATH_BINARY, sizeof(path), path});
}

static Result readSave(const Found *f) {
	FS_Archive archive;
	Handle file;
	Result res = openSaveArchive(f, &archive);
	if (R_FAILED(res)) return res;
	res = FSUSER_OpenFile(&file, archive, fsMakePath(PATH_ASCII, "/main"), FS_OPEN_READ, 0);
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
	FS_Archive archive;
	Handle file;
	Result res = openSaveArchive(f, &archive);
	if (R_FAILED(res)) return res;
	res = FSUSER_OpenFile(&file, archive, fsMakePath(PATH_ASCII, "/main"), FS_OPEN_WRITE, 0);
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

/** Copia de seguridad: sdmc:/3ds/PokeSave/backups/<juego>/<AAAAMMDD-HHMMSS>.main */
static bool backup(const char *tag) {
	char dir[160], file[200];
	snprintf(dir, sizeof(dir), "%s/%s", BACKUP_ROOT, current->game->code);
	mkdirs(dir);
	time_t now = time(NULL);
	struct tm *t = gmtime(&now);
	snprintf(file, sizeof(file), "%s/%04d%02d%02d-%02d%02d%02d-%s.main", dir, t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec, tag);
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
		char json[160];
		snprintf(json, sizeof(json), "{\"app\":\"PokeSave Link\",\"game\":\"%s\",\"size\":%lu}", current->game->code, (unsigned long)saveSize);
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

static int chooseGame(Found *found, int count) {
	int sel = 0;
	while (aptMainLoop()) {
		consoleClear();
		printf("\x1b[1;1H\x1b[31mPokeSave Link\x1b[0m\n\nElige la partida:\n\n");
		for (int i = 0; i < count; i++)
			printf("%s %s (%s)\n", i == sel ? ">" : " ", found[i].game->name, found[i].media == MEDIATYPE_GAME_CARD ? "tarjeta" : "digital");
		printf("\nA: elegir   START: salir\n");
		gspWaitForVBlank();
		hidScanInput();
		u32 k = hidKeysDown();
		if (k & KEY_START) return -1;
		if (k & KEY_DOWN) sel = (sel + 1) % count;
		if (k & KEY_UP) sel = (sel + count - 1) % count;
		if (k & KEY_A) return sel;
		gfxFlushBuffers();
		gfxSwapBuffers();
	}
	return -1;
}

static void waitExit(void) {
	printf("\nPulsa START para salir.\n");
	while (aptMainLoop()) {
		hidScanInput();
		if (hidKeysDown() & KEY_START) break;
		gspWaitForVBlank();
	}
}

int main(void) {
	gfxInitDefault();
	consoleInit(GFX_TOP, NULL);

	// Qué juegos hay (se prueba a abrir su partida en la tarjeta y en la SD).
	Found found[GAME_COUNT * 2];
	int count = 0;
	for (unsigned i = 0; i < GAME_COUNT; i++) {
		for (int m = 0; m < 2; m++) {
			Found f = {&GAMES[i], m == 0 ? MEDIATYPE_GAME_CARD : MEDIATYPE_SD};
			FS_Archive a;
			if (R_SUCCEEDED(openSaveArchive(&f, &a))) {
				FSUSER_CloseArchive(a);
				found[count++] = f;
			}
		}
	}
	if (count == 0) {
		printf("No hay ningun Pokemon de 3DS con partida.\n(X/Y, ROZA, SL o USUL)\n");
		waitExit();
		gfxExit();
		return 0;
	}
	int sel = count == 1 ? 0 : chooseGame(found, count);
	if (sel < 0) {
		gfxExit();
		return 0;
	}
	current = &found[sel];
	consoleClear();
	printf("\x1b[31mPokeSave Link\x1b[0m - %s\n\n", current->game->name);

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
	gfxExit();
	return 0;
}
