using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>
/// Las partidas se generan aquí con PKHeX.Core (BlankSaveFile): el repositorio no contiene
/// partidas reales de nadie. Ver <see cref="LocalSaveTests"/> para probar con partidas propias.
/// </summary>
public class SaveSessionTests
{
    /// <summary>
    /// Juegos cuya partida en blanco PKHeX sabe volver a detectar a partir de los bytes.
    /// Con estos se prueba el ciclo completo: bytes → detección → exportar → bytes.
    /// </summary>
    public static TheoryData<GameVersion, int> DetectableGames => new()
    {
        { GameVersion.B, 5 },
        { GameVersion.W, 5 },
        { GameVersion.B2, 5 },
        { GameVersion.W2, 5 },
        { GameVersion.BD, 8 },
        { GameVersion.SP, 8 },
    };

    /// <summary>
    /// Una partida en blanco de cada generación. Sus bytes no los detecta PKHeX (les faltan
    /// firmas que solo tiene una partida real), así que se prueba sobre el objeto ya creado.
    /// Gen 3 y 4 no aparecen: PKHeX no puede escribir sus partidas en blanco.
    /// </summary>
    public static TheoryData<GameVersion, int> AllGenerations => new()
    {
        { GameVersion.RD, 1 },
        { GameVersion.C, 2 },
        { GameVersion.W, 5 },
        { GameVersion.X, 6 },
        { GameVersion.OR, 6 },
        { GameVersion.SN, 7 },
        { GameVersion.US, 7 },
        { GameVersion.SW, 8 },
        { GameVersion.BD, 8 },
    };

    /// <summary>Las partidas en blanco de estos juegos no traen el bloque del dinero.</summary>
    public static TheoryData<GameVersion, int> NoMoneyBlockGames => new()
    {
        { GameVersion.PLA, 8 },
        { GameVersion.SL, 9 },
        { GameVersion.VL, 9 },
    };

    private static SaveFile MakeBlank(GameVersion version, bool setMoney = true)
    {
        var sav = BlankSaveFile.Get(version, "TESTER", LanguageID.Spanish);
        var pk = sav.BlankPKM;
        pk.Species = (ushort)Species.Pikachu;
        pk.CurrentLevel = 12;
        pk.Language = (int)LanguageID.Spanish;
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, sav.Generation);
        pk.Move1 = (ushort)Move.Tackle;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);
        if (setMoney)
            sav.Money = 1234;
        return sav;
    }

    private static byte[] MakeSaveBytes(GameVersion version)
        => MakeBlank(version).Write(BinaryExportSetting.None).ToArray();

    private static void AssertBlankSummary(SaveSummary summary, int generation)
    {
        Assert.Equal(generation, summary.Generation);
        Assert.Equal("TESTER", summary.Trainer.Name);
        Assert.Equal(1234u, summary.Trainer.Money);
        var first = Assert.Single(summary.Party);
        Assert.Equal((int)Species.Pikachu, first.Species);
        Assert.Equal("Pikachu", first.SpeciesName);
        Assert.Equal(12, first.Level);
        Assert.Contains("Placaje", first.Moves.Select(m => m.Name));
        Assert.Equal("Normal", first.Moves[0].Type.Name);
        var type = Assert.Single(first.Types);
        Assert.Equal(12, type.Id); // Eléctrico
        Assert.Equal("Eléctrico", type.Name);
    }

    [Theory]
    [MemberData(nameof(DetectableGames))]
    public void Detecta_juego_y_generacion_desde_los_bytes(GameVersion version, int generation)
    {
        Assert.True(SaveSession.TryOpen(MakeSaveBytes(version), null, out var session, out var error), error);
        var summary = session!.GetSummary();

        Assert.Equal(version.ToString(), summary.GameId);
        AssertBlankSummary(summary, generation);
    }

    [Theory]
    [MemberData(nameof(DetectableGames))]
    public void Ida_y_vuelta_sin_cambios_devuelve_los_mismos_bytes(GameVersion version, int generation)
    {
        var data = MakeSaveBytes(version);

        Assert.True(SaveSession.TryOpen(data, null, out var session, out _));
        Assert.Equal(generation, session!.Save.Generation);

        Assert.Equal(data, session.Export());
        Assert.Equal(data, session.Original.ToArray());
    }

    [Theory]
    [MemberData(nameof(DetectableGames))]
    public void Ida_y_vuelta_con_cambios_conserva_los_cambios(GameVersion version, int generation)
    {
        var data = MakeSaveBytes(version);
        Assert.True(SaveSession.TryOpen(data, null, out var session, out _));

        Edit(session!.Save);
        var exported = session.Export();

        Assert.True(SaveSession.TryOpen(exported, null, out var reopened, out _));
        Assert.True(reopened!.Save.ChecksumsValid);
        var summary = reopened.GetSummary();
        Assert.Equal(generation, summary.Generation);
        Assert.Equal(4321u, summary.Trainer.Money);
        Assert.Equal(50, summary.Party[0].Level);
        // El original sigue intacto.
        Assert.Equal(data, session.Original.ToArray());
    }

    [Theory]
    [MemberData(nameof(AllGenerations))]
    public void Resumen_y_edicion_funcionan_en_todas_las_generaciones(GameVersion version, int generation)
    {
        var session = SaveSession.FromSave(MakeBlank(version));
        AssertBlankSummary(session.GetSummary(), generation);

        Edit(session.Save);
        var summary = session.GetSummary();
        Assert.Equal(4321u, summary.Trainer.Money);
        Assert.Equal(50, summary.Party[0].Level);
        Assert.NotEmpty(session.Export());
    }

    [Theory]
    [MemberData(nameof(NoMoneyBlockGames))]
    public void Resumen_funciona_en_juegos_sin_bloque_de_dinero(GameVersion version, int generation)
    {
        var session = SaveSession.FromSave(MakeBlank(version, setMoney: false));
        var summary = session.GetSummary();

        Assert.Equal(generation, summary.Generation);
        Assert.Equal("TESTER", summary.Trainer.Name);
        Assert.Null(summary.Trainer.Money); // ilegible, pero no rompe
        var first = Assert.Single(summary.Party);
        Assert.Equal((int)Species.Pikachu, first.Species);
        Assert.Equal(12, first.Level);
    }

    private static void Edit(SaveFile sav)
    {
        sav.Money = 4321;
        var pk = sav.GetPartySlotAtIndex(0);
        pk.CurrentLevel = 50;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);
    }

    [Fact]
    public void El_nombre_del_juego_sigue_el_idioma()
    {
        Assert.True(SaveSession.TryOpen(MakeSaveBytes(GameVersion.W), null, out var session, out _));
        Assert.Equal("Blanca", session!.GetSummary("es").Game);
        Assert.Equal("White", session.GetSummary("en").Game);
    }

    [Theory]
    [InlineData(20, 9)]  // Fuego
    [InlineData(23, 12)] // Eléctrico
    [InlineData(27, 16)] // Siniestro
    [InlineData(7, 6)]   // Bicho
    [InlineData(8, 7)]   // Fantasma
    [InlineData(9, 8)]   // Acero
    [InlineData(3, 3)]   // Veneno
    public void Tipos_de_gen_1_y_2_se_normalizan(int gameBoy, int expected)
    {
        Assert.Equal(expected, SaveSession.NormalizeType(gameBoy, 2));
        Assert.Equal(gameBoy, SaveSession.NormalizeType(gameBoy, 3));
    }

    [Fact]
    public void Archivo_vacio_da_error_claro()
    {
        Assert.False(SaveSession.TryOpen([], null, out var session, out var error));
        Assert.Null(session);
        Assert.Equal("empty", error);
    }

    [Theory]
    [InlineData(1234)]
    [InlineData(0x80000)] // tamaño de Gen 5, pero contenido aleatorio
    [InlineData(0x20000)]
    public void Archivo_basura_no_rompe_y_da_error_claro(int size)
    {
        var junk = new byte[size];
        new Random(42).NextBytes(junk);
        Assert.False(SaveSession.TryOpen(junk, "basura.sav", out _, out var error));
        Assert.Equal("unknown", error);
    }

    [Fact]
    public void El_resumen_se_serializa_a_json()
    {
        Assert.True(SaveSession.TryOpen(MakeSaveBytes(GameVersion.W), null, out var session, out _));
        var json = System.Text.Json.JsonSerializer.Serialize(
            new LoadResult(true, null, session!.GetSummary()), PokeSaveJson.Default.LoadResult);

        Assert.Contains("\"trainer\":{\"name\":\"TESTER\"", json);
        Assert.Contains("\"generation\":5", json);
    }
}

/// <summary>
/// Ida y vuelta con partidas reales propias. Pon tus archivos en tests/saves-local/
/// (está en .gitignore, nunca se suben). Sin archivos, el test no hace nada.
/// </summary>
public class LocalSaveTests
{
    public static TheoryData<string> LocalSaves()
    {
        var data = new TheoryData<string>();
        var dir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "saves-local");
        if (Directory.Exists(dir))
        {
            foreach (var file in Directory.EnumerateFiles(dir))
            {
                if (!Path.GetFileName(file).StartsWith('.') && !file.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
                    data.Add(Path.GetFullPath(file));
            }
        }
        if (data.Count == 0)
            data.Add(""); // xUnit necesita al menos un caso.
        return data;
    }

    [Theory]
    [MemberData(nameof(LocalSaves))]
    public void Partida_real_ida_y_vuelta(string path)
    {
        if (path.Length == 0)
            return;

        var data = File.ReadAllBytes(path);
        Assert.True(SaveSession.TryOpen(data, Path.GetFileName(path), out var session, out var error), error);
        var summary = session!.GetSummary();
        Assert.InRange(summary.Generation, 1, 9);

        var exported = session.Export();
        Assert.True(SaveSession.TryOpen(exported, Path.GetFileName(path), out var reopened, out _));
        Assert.Equal(summary, reopened!.GetSummary(), new SummaryComparer());
    }

    [Theory]
    [MemberData(nameof(LocalSaves))]
    public void Partida_real_sin_cambios_exporta_los_mismos_bytes(string path)
    {
        if (path.Length == 0)
            return;
        var data = File.ReadAllBytes(path);
        Assert.True(SaveSession.TryOpen(data, Path.GetFileName(path), out var session, out _));
        Assert.Equal(data, session!.Export());
    }

    [Theory]
    [MemberData(nameof(LocalSaves))]
    public void Partida_real_editar_nivel_y_dinero(string path)
    {
        // Criterio de aceptación 3, con una partida de verdad.
        if (path.Length == 0)
            return;
        var name = Path.GetFileName(path);
        Assert.True(SaveSession.TryOpen(File.ReadAllBytes(path), name, out var session, out _));
        var first = new SlotRef(SlotRef.Party, 0, 0);
        var detail = session!.GetPokemon(first);
        Assert.NotNull(detail);

        int level = detail!.Edit.Level == 100 ? 99 : detail.Edit.Level + 1;
        var r = session.SetPokemon(first, detail.Edit with { Level = level });
        Assert.True(r.Ok, r.Error);
        uint money = (session.GetSummary().Trainer.Money ?? 0) == 1234 ? 4321u : 1234u;
        Assert.True(session.SetTrainer(new TrainerEdit(session.Save.OT, money)).Ok);

        Assert.True(SaveSession.TryOpen(session.Export(), name, out var reopened, out _));
        Assert.True(reopened!.Save.ChecksumsValid);
        var summary = reopened.GetSummary();
        Assert.Equal(level, summary.Party[0].Level);
        Assert.Equal(money, summary.Trainer.Money);
        // El resto del equipo no se toca.
        Assert.Equal(session.GetSummary().Party.Count, summary.Party.Count);
    }

    private sealed class SummaryComparer : IEqualityComparer<SaveSummary>
    {
        public bool Equals(SaveSummary? a, SaveSummary? b)
            => a is not null && b is not null
               && a.GameId == b.GameId
               && a.Trainer with { Badges = null } == b.Trainer with { Badges = null }
               && (a.Trainer.Badges?.Flags ?? []).SequenceEqual(b.Trainer.Badges?.Flags ?? [])
               && a.BoxNames.SequenceEqual(b.BoxNames)
               && a.Party.SequenceEqual(b.Party, new PokemonComparer())
               && a.StoredCount == b.StoredCount;

        public int GetHashCode(SaveSummary obj) => obj.GameId.GetHashCode();
    }

    private sealed class PokemonComparer : IEqualityComparer<PokemonInfo>
    {
        public bool Equals(PokemonInfo? a, PokemonInfo? b)
            => a is not null && b is not null
               && a with { Moves = [], Types = [] } == b with { Moves = [], Types = [] }
               && a.Moves.SequenceEqual(b.Moves)
               && a.Types.SequenceEqual(b.Types);

        public int GetHashCode(PokemonInfo obj) => obj.Species;
    }
}
