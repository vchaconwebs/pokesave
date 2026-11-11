using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>Editar la Pokédex en todos los juegos (salvo Leyendas: Arceus, que es de tareas).</summary>
public class DexAllGamesTests
{
    public static TheoryData<GameVersion> Games => new()
    {
        GameVersion.RD, GameVersion.C, GameVersion.E, GameVersion.FR, GameVersion.D, GameVersion.Pt, GameVersion.HG,
        GameVersion.W, GameVersion.B2, GameVersion.X, GameVersion.OR, GameVersion.SN, GameVersion.US, GameVersion.GP,
        GameVersion.SW, GameVersion.BD, GameVersion.SL, GameVersion.ZA,
    };

    private static SaveSession Make(GameVersion v) => v switch
    {
        GameVersion.E or GameVersion.FR => SaveSession.FromSave(SaveUtil.GetSaveFile(RealFormatTests.MakeGen3(v))!),
        GameVersion.D or GameVersion.Pt or GameVersion.HG => SaveSession.FromSave(SaveUtil.GetSaveFile(RealFormatTests.MakeGen4(v))!),
        _ => SaveSession.FromSave(BlankSaveFile.Get(v, "TESTER", LanguageID.English)),
    };

    private static DexEntry Entry(SaveSession s, int species) => s.GetDex().Entries.First(e => e.Species == species);

    [Theory]
    [MemberData(nameof(Games))]
    public void Visto_capturado_y_quitar(GameVersion v)
    {
        var s = Make(v);
        Assert.True(s.GetDex().Editable);
        const int pikachu = 25;

        Assert.True(s.SetDex(new DexEdit([pikachu], true, true)).Ok);
        var e = Entry(s, pikachu);
        Assert.True(e.Seen && e.Caught, "capturado");

        Assert.True(s.SetDex(new DexEdit([pikachu], true, false)).Ok);
        e = Entry(s, pikachu);
        Assert.True(e.Seen && !e.Caught, "solo visto");

        Assert.True(s.SetDex(new DexEdit([pikachu], false, false)).Ok);
        e = Entry(s, pikachu);
        Assert.False(e.Seen || e.Caught, "quitado");
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void Completar_toda_la_Pokedex(GameVersion v)
    {
        var s = Make(v);
        Assert.True(s.SetDex(new DexEdit([], true, true)).Ok);
        var dex = s.GetDex();
        Assert.All(dex.Entries, e => Assert.True(e.Caught, $"#{e.Species} {e.Name}"));
        Assert.NotEmpty(s.Export());
    }

    [Fact]
    public void Leyendas_Arceus_sigue_en_solo_lectura()
    {
        var s = SaveSession.FromSave(BlankSaveFile.Get(GameVersion.PLA, "TESTER", LanguageID.English));
        Assert.False(s.GetDex().Editable);
        Assert.Equal("dex-unsupported", s.SetDex(new DexEdit([25], true, true)).Error);
    }
}

/// <summary>Pokédex regionales: qué sale en cada juego y con cuántas especies (según Bulbapedia).</summary>
public class RegionalDexTests
{
    public static TheoryData<GameVersion, string> Expected => new()
    {
        { GameVersion.RD, "kanto:151" },
        { GameVersion.C, "johto:251" },
        { GameVersion.E, "hoenn:202" },
        { GameVersion.FR, "kanto:151" },
        { GameVersion.D, "sinnoh:151" },
        { GameVersion.Pt, "sinnoh:210" },
        { GameVersion.HG, "johto:256" },
        { GameVersion.W, "unova:156" },
        { GameVersion.B2, "unova:301" },
        { GameVersion.X, "kalos-central:153 kalos-coastal:153 kalos-mountain:151" },
        { GameVersion.OR, "hoenn:211" },
        { GameVersion.SN, "alola:302 melemele:120 akala:130 ulaula:130 poni:100" },
        { GameVersion.US, "alola:403 melemele:150 akala:160 ulaula:160 poni:130" },
        { GameVersion.GP, "kanto:153" },
        { GameVersion.SW, "galar:400 armor:211 crown:210" },
        { GameVersion.BD, "sinnoh:151" },
        { GameVersion.PLA, "hisui:242" },
        { GameVersion.SL, "paldea:400 kitakami:200 blueberry:243" },
        { GameVersion.ZA, "lumiose:232 hyperspace:132" },
    };

    [Theory]
    [MemberData(nameof(Expected))]
    public void Cada_juego_tiene_sus_regionales(GameVersion v, string expected)
    {
        var sav = v switch
        {
            GameVersion.E or GameVersion.FR => SaveUtil.GetSaveFile(RealFormatTests.MakeGen3(v))!,
            GameVersion.D or GameVersion.Pt or GameVersion.HG => SaveUtil.GetSaveFile(RealFormatTests.MakeGen4(v))!,
            _ => BlankSaveFile.Get(v, "TESTER", LanguageID.English),
        };
        var regions = SaveSession.FromSave(sav).GetDex().Regions;
        Assert.Equal(expected, string.Join(' ', regions.Select(r => $"{r.Key}:{r.Entries.Count}")));
        foreach (var r in regions)
        {
            // Números seguidos y sin repetir especie.
            var nums = r.Entries.Select(e => e.Number).ToList();
            Assert.Equal(Enumerable.Range(nums[0], nums.Count), nums);
            Assert.Equal(r.Entries.Count, r.Entries.Select(e => e.Species).Distinct().Count());
        }
    }
}
