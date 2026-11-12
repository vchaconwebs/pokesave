// Memoria de partida de los cartuchos de DS (chip SPI). Ver spi.c (portado de Checkpoint).
#pragma once
#include <3ds.h>

typedef enum {
	NO_CHIP = -1,
	FLASH_256KB_1 = 4,
	FLASH_256KB_2 = 5,
	FLASH_512KB_1 = 6,
	FLASH_512KB_2 = 7,
	FLASH_1MB = 8,
	FLASH_STD_DUMMY = 4,
	FLASH_512KB_INFRARED = 10,
	FLASH_256KB_INFRARED = 11,
	FLASH_INFRARED_DUMMY = 9,
} CardType;

/** Tipo de chip. infrared: el código del juego empieza por 'I' (cartuchos con infrarrojos). */
Result spiGetCardType(CardType *type, bool infrared);
u32 spiCapacity(CardType type);
Result spiRead(CardType type, u32 offset, void *data, u32 size);
Result spiWrite(CardType type, u32 offset, const void *data, u32 size);
