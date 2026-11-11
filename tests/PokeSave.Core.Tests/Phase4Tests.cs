using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

public class Phase4Tests
{
    private static SaveSession Make(GameVersion v) => v switch
    {
        GameVersion.E or GameVersion.FR => SaveSession.FromSave(SaveUtil.GetSaveFile(RealFormatTests.MakeGen3(v))!),
        GameVersion.Pt or GameVersion.HG => SaveSession.FromSave(SaveUtil.GetSaveFile(RealFormatTests.MakeGen4(v))!),
        GameVersion.RD or GameVersion.C => SaveSession.FromSave(SaveUtil.GetSaveFile(RealFormatTests.MakeGen12(v))!),
        _ => SaveSession.FromSave(BlankSaveFile.Get(v, "TESTER", LanguageID.Spanish)),
    };

    /// <summary>La MT01 de cada juego y el movimiento que enseña (nombres en español).</summary>
    [Theory]
    [InlineData(GameVersion.RD, "TM01", "Megapuño")] // la lista de Gen 1 de PKHeX no está traducida
    [InlineData(GameVersion.C, "MT01", "Puño Dinámico")]
    [InlineData(GameVersion.E, "MT01", "Puño Certero")]
    [InlineData(GameVersion.FR, "MO01", "Corte")]
    [InlineData(GameVersion.Pt, "MT01", "Puño Certero")]
    [InlineData(GameVersion.HG, "MO05", "Torbellino")]
    [InlineData(GameVersion.W, "MT01", "Afilagarras")]
    [InlineData(GameVersion.X, "MT01", "Afilagarras")]
    [InlineData(GameVersion.SN, "MT01", "Avivar")]
    [InlineData(GameVersion.SW, "MT00", "Megapuño")]
    [InlineData(GameVersion.BD, "MT01", "Puño Certero")]
    [InlineData(GameVersion.SL, "MT001", "Derribo")]
    [InlineData(GameVersion.SL, "MT229", "Palma Rauda")]
    [InlineData(GameVersion.SW, "MT99", "Vasto Impacto")]
    [InlineData(GameVersion.SW, "DT00", "Danza Espada")]
    public void Cada_MT_dice_su_movimiento(GameVersion v, string tm, string move)
    {
        var finder = Make(v).GetItemFinder();
        var item = finder.Items.FirstOrDefault(i => i.Name == tm);
        Assert.NotNull(item);
        Assert.Equal(move, item!.MoveName);
    }

    [Fact]
    public void Cuenta_lo_que_tienes_en_la_mochila()
    {
        var s = Make(GameVersion.W);
        Assert.True(s.SetPouch(new PouchEdit("Medicine", [new BagItemEdit(17, 3)])).Ok); // Poción
        var potion = s.GetItemFinder().Items.Single(i => i.Id == 17);
        Assert.Equal(3, potion.Count);
        Assert.Equal("Medicine", potion.Pouch);
    }

    [Theory]
    [InlineData(GameVersion.E)]
    [InlineData(GameVersion.FR)]
    [InlineData(GameVersion.C)]
    [InlineData(GameVersion.RD)]
    public void Lee_los_flags_de_evento(GameVersion v)
    {
        var s = Make(v);
        var flags = (IEventFlagArray)s.Save;
        flags.SetEventFlag(0x3E8 % flags.EventFlagCount, true);
        var read = s.GetEventFlags([0x3E8 % flags.EventFlagCount, 1, 999_999]);
        Assert.NotNull(read);
        Assert.Equal([true, false, false], read);
    }
}
