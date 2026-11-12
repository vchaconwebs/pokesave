// Acceso a la memoria de partida de los cartuchos de DS (chip SPI) desde la 3DS.
//
// Portado a C de Checkpoint (3ds/source/spi.cpp), que a su vez viene de TWLSaveTool:
//   Checkpoint  — Copyright (C) 2017-2025 Bernardo Giordano, FlagBrew (GPLv3)
//   TWLSaveTool — Copyright (C) 2015-2016 TuxSH (GPLv2 o posterior)
//   savegame_manager — Copyright (C) Pokedoc (2010) (GPLv2 o posterior)
// Modificado para PokeSave Link: solo lo que usan los Pokémon de DS (flash de 512 KB, con o
// sin infrarrojos), sin el soporte de EEPROM pequeñas ni del flash de 8 MB.
#include "spi.h"

#define SPI_CMD_READ 3
#define SPI_CMD_RDSR 5
#define SPI_CMD_WREN 6
#define SPI_FLASH_CMD_PW 10
#define SPI_FLASH_CMD_RDID 0x9f
#define SPI_FLG_WIP 1
#define SPI_FLG_WEL 2

static Result spiWriteRead(CardType type, void *cmd, u32 cmdSize, void *answer, u32 answerSize, void *data, u32 dataSize) {
	u8 op = pxiDevMakeTransferOption(BAUDRATE_4MHZ, BUSMODE_1BIT), op2 = pxiDevMakeTransferOption(BAUDRATE_1MHZ, BUSMODE_1BIT);
	u64 wait = pxiDevMakeWaitOperation(WAIT_NONE, DEASSERT_NONE, 0LL);
	u64 headerFooter = 0;
	bool ir = type == FLASH_512KB_INFRARED || type == FLASH_256KB_INFRARED;
	// Los cartuchos con infrarrojos llevan el chip detrás del de infrarrojos: hay que mandar un
	// byte 0 a 1 MHz antes de cada orden.
	PXIDEV_SPIBuffer header = {&headerFooter, ir ? 1U : 0U, ir ? op2 : op, wait};
	PXIDEV_SPIBuffer cmdB = {cmd, cmdSize, op, wait};
	PXIDEV_SPIBuffer ansB = {answer, answerSize, op, wait};
	PXIDEV_SPIBuffer dataB = {data, dataSize, op, wait};
	PXIDEV_SPIBuffer nullB = {NULL, 0U, op, wait};
	PXIDEV_SPIBuffer footer = {&headerFooter, 0U, op, wait};
	return PXIDEV_SPIMultiWriteRead(&header, &cmdB, &ansB, &dataB, &nullB, &footer);
}

static Result spiWaitWriteEnd(CardType type) {
	u8 cmd = SPI_CMD_RDSR, sr = 0;
	int panic = 0;
	do {
		Result res = spiWriteRead(type, &cmd, 1, &sr, 1, 0, 0);
		if (res) return res;
	} while ((sr & SPI_FLG_WIP) && ++panic < 1000);
	return panic >= 1000 ? 1 : 0;
}

static Result spiEnableWriting(CardType type) {
	u8 cmd = SPI_CMD_WREN, sr = 0;
	Result res = spiWriteRead(type, &cmd, 1, NULL, 0, 0, 0);
	if (res) return res;
	cmd = SPI_CMD_RDSR;
	int panic = 0;
	do {
		res = spiWriteRead(type, &cmd, 1, &sr, 1, 0, 0);
		if (res) return res;
		if (!(sr & ~SPI_FLG_WEL)) break;
	} while (++panic < 1000);
	return panic >= 1000 ? 1 : 0;
}

static Result spiReadJedecAndStatus(CardType type, u32 *id, u8 *status) {
	u8 cmd = SPI_FLASH_CMD_RDID, reg = 0, buf[3] = {0};
	Result res = spiWaitWriteEnd(type);
	if (res) return res;
	if ((res = spiWriteRead(type, &cmd, 1, buf, 3, 0, 0))) return res;
	cmd = SPI_CMD_RDSR;
	if ((res = spiWriteRead(type, &cmd, 1, &reg, 1, 0, 0))) return res;
	*id = (buf[0] << 16) | (buf[1] << 8) | buf[2];
	*status = reg;
	return 0;
}

u32 spiCapacity(CardType type) {
	switch (type) {
	case FLASH_256KB_1: case FLASH_256KB_2: case FLASH_256KB_INFRARED: return 256 * 1024;
	case FLASH_512KB_1: case FLASH_512KB_2: case FLASH_512KB_INFRARED: return 512 * 1024;
	case FLASH_1MB: return 1024 * 1024;
	default: return 0;
	}
}

Result spiGetCardType(CardType *type, bool infrared) {
	static const u32 ordered[] = {0x204012, 0x621600, 0x204013, 0x621100, 0x204014};
	CardType t = infrared ? FLASH_INFRARED_DUMMY : FLASH_STD_DUMMY;
	u32 jedec = 0;
	u8 sr = 0;
	Result res = spiReadJedecAndStatus(t, &jedec, &sr);
	if (res) return res;
	*type = NO_CHIP;
	if (infrared) {
		// Igual que Checkpoint: el JEDEC se pide sin el byte previo de infrarrojos y casi nunca
		// responde, así que un cartucho con infrarrojos se toma como flash de 512 KB (256 KB
		// solo si el JEDEC dice que lo es; no es el caso de ningún Pokémon).
		*type = (jedec == ordered[0] || jedec == ordered[1]) ? FLASH_256KB_INFRARED : FLASH_512KB_INFRARED;
		return 0;
	}
	if ((sr & 0xfd) == 0x00 && jedec != 0x00ffffff) {
		if (jedec == 0x208013) { *type = FLASH_512KB_1; return 0; }
		for (int i = 0; i < 5; i++) {
			if (jedec == ordered[i]) { *type = (CardType)(FLASH_256KB_1 + i); return 0; }
		}
		return 0;
	}
	// EEPROM u otro chip que no usa ningún Pokémon: no se toca.
	return 0;
}

Result spiRead(CardType type, u32 offset, void *data, u32 size) {
	if (type == NO_CHIP) return 0xC8E13404;
	Result res = spiWaitWriteEnd(type);
	if (res) return res;
	u8 cmd[4] = {SPI_CMD_READ, (u8)(offset >> 16), (u8)(offset >> 8), (u8)offset};
	return spiWriteRead(type, cmd, 4, data, size, NULL, 0);
}

Result spiWrite(CardType type, u32 offset, const void *data, u32 size) {
	const u32 page = 256;
	if (type == NO_CHIP || size == 0) return 0xC8E13404;
	Result res = spiWaitWriteEnd(type);
	if (res) return res;
	u32 end = offset + size, pos = offset;
	while (pos < end) {
		// "Page write" (0x0A): borra y escribe la página de 256 bytes de una vez.
		u8 cmd[4] = {SPI_FLASH_CMD_PW, (u8)(pos >> 16), (u8)(pos >> 8), (u8)pos};
		u32 n = page - (pos % page);
		if (n > end - pos) n = end - pos;
		if ((res = spiEnableWriting(type))) return res;
		if ((res = spiWriteRead(type, cmd, 4, NULL, 0, (void *)((const u8 *)data + (pos - offset)), n))) return res;
		if ((res = spiWaitWriteEnd(type))) return res;
		pos += n;
	}
	return 0;
}
