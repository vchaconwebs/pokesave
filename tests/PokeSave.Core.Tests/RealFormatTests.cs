using System.Buffers.Binary;
using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>
/// Partidas de Gen 1-4 con el formato de las de verdad (firmas, sectores, pies de bloque),
/// fabricadas aquí. Las partidas en blanco de PKHeX no sirven: en Gen 3/4 no se pueden ni
/// escribir y en Gen 1/2 no se reconocen. Con estas se prueba el ciclo completo:
/// bytes → detección → editar → exportar → volver a detectar, con checksums válidos.
/// El formato está sacado del propio PKHeX (SaveUtil, SAV3, SAV4, SAV4BlockDetection).
/// </summary>
public class RealFormatTests
{
    // ---------- Fabricar los bytes ----------

    private const int G3SectorSize = 0x1000;
    private const uint G3Signature = 0x08012025;

    /// <summary>Gen 3: 128 KB, dos ranuras de 14 sectores con ID, firma y contador.</summary>
    public static byte[] MakeGen3(GameVersion game)
    {
        var data = new byte[0x20000];
        for (int slot = 0; slot < 2; slot++)
        {
            for (int id = 0; id < 14; id++)
            {
                var sector = data.AsSpan(slot * 14 * G3SectorSize + id * G3SectorSize, G3SectorSize);
                BinaryPrimitives.WriteInt16LittleEndian(sector[0xFF4..], (short)id);
                BinaryPrimitives.WriteUInt32LittleEndian(sector[0xFF8..], G3Signature);
                BinaryPrimitives.WriteUInt32LittleEndian(sector[0xFFC..], (uint)(slot + 1)); // la ranura 2 es la más nueva
            }
            var small = data.AsSpan(slot * 14 * G3SectorSize, G3SectorSize);
            // El juego rellena con 0xFF el nombre del entrenador. Si 0x06 vale 0, PKHeX la toma por japonesa.
            small[..8].Fill(0xFF);
            // 0xAC: RS = 0 (sin datos de Torre Batalla), FRLG = 1 fijo, E = clave de cifrado.
            switch (game)
            {
                case GameVersion.FR or GameVersion.LG:
                    BinaryPrimitives.WriteUInt32LittleEndian(small[0xAC..], 1);
                    break;
                case GameVersion.E:
                    BinaryPrimitives.WriteUInt32LittleEndian(small[0xAC..], 0x1234_5678);
                    small[0x900] = 1; // Esmeralda tiene datos tras 0x890
                    break;
            }
        }
        return data;
    }

    /// <summary>Gen 4: 512 KB, dos particiones con bloque general y de cajas, cada uno con su pie.</summary>
    public static byte[] MakeGen4(GameVersion game)
    {
        var (gSize, sStart, sSize) = game switch
        {
            GameVersion.D or GameVersion.P => (0xC100, 0xC100, 0x121E0),
            GameVersion.Pt => (0xCF2C, 0xCF2C, 0x121E4),
            _ => (0xF628, 0xF700, 0x12310), // HGSS
        };
        var data = new byte[0x80000];
        for (int part = 0; part < 2; part++)
        {
            int baseOfs = part * 0x40000;
            WriteFooter(data.AsSpan(baseOfs, gSize), (uint)(part + 1));
            WriteFooter(data.AsSpan(baseOfs + sStart, sSize), (uint)(part + 1));
        }
        return data;

        static void WriteFooter(Span<byte> block, uint counter)
        {
            // Pie (0x14): contador mayor, contador menor, tamaño, magia, id + checksum.
            BinaryPrimitives.WriteUInt32LittleEndian(block[^0x14..], counter);
            BinaryPrimitives.WriteUInt32LittleEndian(block[^0x10..], counter);
            BinaryPrimitives.WriteUInt32LittleEndian(block[^0xC..], (uint)block.Length);
            BinaryPrimitives.WriteUInt32LittleEndian(block[^0x8..], SAV4.MAGIC_JAPAN_INTL);
        }
    }

    /// <summary>Gen 1/2: la partida en blanco con un Pokémon en el equipo ya tiene las listas bien formadas.</summary>
    public static byte[] MakeGen12(GameVersion game)
    {
        var sav = BlankSaveFile.Get(game, "ASH", LanguageID.English);
        var pk = sav.BlankPKM;
        pk.Species = (ushort)Species.Pikachu;
        pk.CurrentLevel = 5;
        pk.Move1 = (ushort)Move.ThunderShock;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);
        var data = sav.Write(BinaryExportSetting.None).ToArray();
        // La caja actual vacía es "0 Pokémon + 0xFF" en una partida real; la en blanco deja 0x00.
        int box = game switch { GameVersion.GD or GameVersion.SI => 0x2D6C, GameVersion.C => 0x2D10, _ => 0x30C0 };
        if (data[box] == 0)
            data[box + 1] = 0xFF;
        return data;
    }

    public static TheoryData<GameVersion, int> Games => new()
    {
        { GameVersion.RD, 1 },
        { GameVersion.YW, 1 },
        { GameVersion.GD, 2 },
        { GameVersion.C, 2 },
        { GameVersion.R, 3 },
        { GameVersion.E, 3 },
        { GameVersion.FR, 3 },
        { GameVersion.D, 4 },
        { GameVersion.Pt, 4 },
        { GameVersion.HG, 4 },
    };

    private static byte[] Make(GameVersion game) => game switch
    {
        GameVersion.R or GameVersion.S or GameVersion.E or GameVersion.FR or GameVersion.LG => MakeGen3(game),
        GameVersion.D or GameVersion.P or GameVersion.Pt or GameVersion.HG or GameVersion.SS => MakeGen4(game),
        _ => MakeGen12(game),
    };

    private static SaveSession Open(byte[] bytes)
    {
        Assert.True(SaveSession.TryOpen(bytes, "partida.sav", out var s, out var error), error);
        return s!;
    }

    /// <summary>Tipo de partida que debe salir para cada juego.</summary>
    private static Type Expected(GameVersion game) => game switch
    {
        GameVersion.RD or GameVersion.YW => typeof(SAV1),
        GameVersion.GD or GameVersion.C => typeof(SAV2),
        GameVersion.R => typeof(SAV3RS),
        GameVersion.E => typeof(SAV3E),
        GameVersion.FR => typeof(SAV3FRLG),
        GameVersion.D => typeof(SAV4DP),
        GameVersion.Pt => typeof(SAV4Pt),
        _ => typeof(SAV4HGSS),
    };

    // ---------- Pruebas ----------

    [Theory]
    [MemberData(nameof(Games))]
    public void Se_detecta_el_juego_correcto(GameVersion game, int generation)
    {
        var s = Open(Make(game));
        Assert.Equal(generation, s.Save.Generation);
        Assert.IsType(Expected(game), s.Save);
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void Ciclo_completo_editar_exportar_y_volver_a_abrir(GameVersion game, int generation)
    {
        var s = Open(Make(game));
        Assert.True(s.SetTrainer(new TrainerEdit("RED", 4321)).Ok);

        // Un Pokémon en la caja 1 para poder editarlo (las de Gen 3/4 fabricadas están vacías).
        var pk = s.Save.BlankPKM;
        pk.Species = (ushort)Species.Eevee;
        pk.CurrentLevel = 10;
        pk.Language = (int)LanguageID.English;
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, (byte)generation);
        pk.OriginalTrainerName = "RED";
        pk.Move1 = (ushort)Move.Tackle;
        if (generation >= 3)
            pk.Version = s.Save.Version;
        pk.ResetPartyStats();
        pk.RefreshChecksum();
        s.Save.SetBoxSlotAtIndex(pk, 0, 0);

        var at = new SlotRef(SlotRef.BoxKind, 0, 0);
        var detail = s.GetPokemon(at);
        Assert.NotNull(detail);
        var r = s.SetPokemon(at, detail!.Edit with { Level = 42 });
        Assert.True(r.Ok, r.Error);

        var bytes = s.Export();
        Assert.True(s.Save.ChecksumsValid, s.Save.ChecksumInfo);

        var again = Open(bytes);
        Assert.IsType(Expected(game), again.Save);
        var summary = again.GetSummary();
        Assert.Equal("RED", summary.Trainer.Name);
        Assert.Equal(4321u, summary.Trainer.Money);
        var back = again.GetPokemon(at);
        Assert.NotNull(back);
        Assert.Equal((int)Species.Eevee, back!.Info.Species);
        Assert.Equal(42, back.Info.Level);
        Assert.True(again.Save.ChecksumsValid, again.Save.ChecksumInfo);
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void Abrir_y_exportar_sin_cambios_da_los_mismos_bytes(GameVersion game, int _)
    {
        // La primera escritura rellena los checksums; a partir de ahí, abrir y exportar sin
        // tocar nada tiene que dar exactamente los mismos bytes, como con una partida real.
        var first = Open(Make(game)).Export();
        var second = Open(first).Export();
        Assert.Equal(first, second);
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void Mochila_Pokedex_e_importar_funcionan_y_sobreviven_al_exportar(GameVersion game, int generation)
    {
        var s = Open(Make(game));

        // Mochila: meter una Poké Ball en su bolsillo.
        var bag = s.GetBag();
        Assert.NotEmpty(bag.Pouches);
        var balls = bag.Pouches.First(p => p.Allowed.Any(o => o.Id == 4)); // 4 = Poké Ball en todas
        var r = s.SetPouch(new PouchEdit(balls.Type, [new BagItemEdit(4, 7)]));
        Assert.True(r.Ok, r.Error);

        // Pokédex: marcar a Mew como capturado.
        Assert.True(s.GetDex().Editable);
        r = s.SetDex(new DexEdit([151], true, true));
        Assert.True(r.Ok, r.Error);

        // Showdown en el primer hueco libre de la caja 1.
        r = s.ImportShowdown(new SlotRef(SlotRef.BoxKind, 0, 5), string.Join(Environment.NewLine, "Pikachu", "Level: 20", "- Thunder Shock", "- Growl"));
        Assert.True(r.Ok, r.Error);

        var again = Open(s.Export());
        Assert.True(again.Save.ChecksumsValid, again.Save.ChecksumInfo);
        var pouch = again.GetBag().Pouches.First(p => p.Type == balls.Type);
        Assert.Contains(pouch.Items, i => i.Id == 4 && i.Count == 7);
        var mew = again.GetDex().Entries.First(e => e.Species == 151);
        Assert.True(mew.Seen && mew.Caught);
        // En Gen 1/2 las cajas son listas: va al primer hueco libre (el 0).
        var pika = again.GetPokemon(new SlotRef(SlotRef.BoxKind, 0, generation <= 2 ? 0 : 5));
        Assert.NotNull(pika);
        Assert.Equal((int)Species.Pikachu, pika!.Info.Species);
        Assert.Equal(20, pika.Info.Level);
    }
}
