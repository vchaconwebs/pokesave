using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>
/// Que nada que no exista en un juego pueda acabar en su partida: movimientos quitados del
/// juego, especies o formas de otras generaciones, objetos que no se pueden llevar.
/// </summary>
public class SafetyTests
{
    private static readonly SlotRef First = new(SlotRef.Party, 0, 0);

    public static TheoryData<GameVersion> Games => new()
    {
        GameVersion.RD, GameVersion.C, GameVersion.W, GameVersion.B2, GameVersion.X, GameVersion.SN,
        GameVersion.SW, GameVersion.BD, GameVersion.PLA, GameVersion.SL,
    };

    /// <summary>Juegos donde hay movimientos con número válido que NO existen en el juego.</summary>
    public static TheoryData<GameVersion> GamesWithRemovedMoves => new() { GameVersion.SW, GameVersion.BD, GameVersion.PLA, GameVersion.SL };

    private static SaveSession Blank(GameVersion version)
    {
        var sav = BlankSaveFile.Get(version, "TESTER", LanguageID.English);
        var pk = sav.BlankPKM;
        // Una especie que esté en todos estos juegos (Leyendas no tiene a Pikachu de inicio... sí lo tiene).
        pk.Species = (ushort)Species.Pikachu;
        pk.Language = (int)LanguageID.English;
        pk.CurrentLevel = 12;
        pk.OriginalTrainerName = "TESTER";
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, sav.Generation);
        pk.Move1 = (ushort)Move.ThunderShock;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);
        return SaveSession.FromSave(sav);
    }

    [Theory]
    [MemberData(nameof(Games))]
    public void Las_listas_solo_tienen_cosas_del_juego(GameVersion version)
    {
        var s = Blank(version);
        var sav = s.Save;
        var lists = s.GetLists();

        Assert.All(lists.Species, o => Assert.True(sav.Personal.IsSpeciesInGame((ushort)o.Id), $"especie {o.Id}"));
        Assert.All(lists.Moves, o => Assert.True(o.Id <= sav.MaxMoveID && s.IsMoveInGame(o.Id), $"movimiento {o.Id}"));
        var held = sav.HeldItems.ToArray().Select(i => (int)i).ToHashSet();
        Assert.All(lists.Items, o => Assert.Contains(o.Id, held));

        foreach (var pouch in s.GetBag().Pouches)
        {
            var legal = sav.Inventory.Pouches.First(p => p.Type.ToString() == pouch.Type).GetAllItems().ToArray().Select(i => (int)i).ToHashSet();
            Assert.All(pouch.Allowed, o => Assert.Contains(o.Id, legal));
            Assert.All(pouch.Allowed, o => Assert.InRange(o.Id, 1, sav.MaxItemID));
        }
    }

    [Theory]
    [MemberData(nameof(GamesWithRemovedMoves))]
    public void Un_movimiento_quitado_del_juego_se_rechaza(GameVersion version)
    {
        var s = Blank(version);
        int removed = Enumerable.Range(1, s.Save.MaxMoveID).First(m => !s.IsMoveInGame(m));
        var before = s.Export();
        var edit = s.GetPokemon(First)!.Edit with { Moves = [removed, 0, 0, 0] };

        Assert.Equal("moves", s.SetPokemon(First, edit).Error);
        Assert.Equal("moves", s.PreviewPokemon(First, edit).Error);
        Assert.Equal(before, s.Export());
    }

    [Theory]
    [MemberData(nameof(GamesWithRemovedMoves))]
    public void Showdown_con_un_movimiento_quitado_del_juego_se_rechaza(GameVersion version)
    {
        var s = Blank(version);
        int removed = Enumerable.Range(1, s.Save.MaxMoveID).First(m => !s.IsMoveInGame(m));
        var name = GameInfo.GetStrings("en").movelist[removed];
        var r = s.ImportShowdown(new SlotRef(SlotRef.BoxKind, 0, 0), $"Pikachu\n- {name}");
        Assert.Equal("pk-moves", r.Error);
    }

    [Fact]
    public void Una_forma_que_no_existe_en_el_juego_se_rechaza()
    {
        // El Raichu de Alola no existe en Blanco.
        var bytes = BlankSaveFile.Get(GameVersion.W, "TESTER", LanguageID.English).Write(BinaryExportSetting.None).ToArray();
        Assert.True(SaveSession.TryOpen(bytes, null, out var s, out _));
        var r = s!.ImportShowdown(new SlotRef(SlotRef.BoxKind, 0, 0), "Raichu-Alola\nAbility: Surge Surfer\n- Thunderbolt");
        Assert.Equal("pk-species", r.Error);
        Assert.Equal(0, s.Save.GetBoxSlotAtIndex(0, 0).Species);
    }

    [Fact]
    public void Importar_un_archivo_con_un_movimiento_que_no_existe_se_rechaza()
    {
        // Un PK8 de Espada/Escudo con un movimiento que no está en ese juego.
        var s = Blank(GameVersion.SW);
        int removed = Enumerable.Range(1, s.Save.MaxMoveID).First(m => !s.IsMoveInGame(m));
        var pk = (PK8)s.Save.GetPartySlotAtIndex(0).Clone();
        pk.Move1 = (ushort)removed;
        pk.RefreshChecksum();
        var buffer = new byte[pk.SIZE_PARTY];
        int n = pk.WriteDecryptedDataStored(buffer);

        var r = s.ImportPokemonFile(new SlotRef(SlotRef.BoxKind, 0, 0), buffer.AsSpan(0, n).ToArray(), "x.pk8");
        Assert.Equal("pk-moves", r.Error);
    }

    [Fact]
    public void Importar_un_pokemon_con_objeto_de_otro_juego_le_quita_el_objeto()
    {
        // Un PK8 con un objeto que en Blanco no existe: se importa, pero sin el objeto.
        var bytes = BlankSaveFile.Get(GameVersion.W, "TESTER", LanguageID.English).Write(BinaryExportSetting.None).ToArray();
        Assert.True(SaveSession.TryOpen(bytes, null, out var s, out _));
        var pk4 = new PK4 { Species = (ushort)Species.Pikachu, CurrentLevel = 20, Move1 = (ushort)Move.Tackle, Language = 2, OriginalTrainerName = "OLD", HeldItem = 1 };
        pk4.Nickname = SpeciesName.GetSpeciesName(pk4.Species, 2);
        pk4.RefreshChecksum();
        var r = s!.ImportPokemonFile(new SlotRef(SlotRef.BoxKind, 0, 0), pk4.Data.ToArray(), "x.pk4");
        Assert.True(r.Ok, r.Error);
        Assert.True(r.Pokemon!.Edit.HeldItem == 0 || s.GetLists().Items.Any(i => i.Id == r.Pokemon.Edit.HeldItem));
    }

    // ---------- Pokédex regional ----------

    [Fact]
    public void Blanco_tiene_la_Pokedex_de_Teselia()
    {
        var s = Blank(GameVersion.W);
        var dex = s.GetDex();
        Assert.Equal(649, dex.Entries.Count);
        var unova = Assert.Single(dex.Regions);
        Assert.Equal("unova", unova.Key);
        Assert.Equal(156, unova.Entries.Count);
        Assert.Equal(new RegionEntry((int)Species.Victini, 0), unova.Entries[0]);
        Assert.Equal(new RegionEntry((int)Species.Snivy, 1), unova.Entries[1]);
        Assert.Equal(new RegionEntry((int)Species.Genesect, 155), unova.Entries[^1]);
    }

    [Theory]
    [InlineData(GameVersion.SW, new[] { "galar", "armor", "crown" })]
    [InlineData(GameVersion.BD, new[] { "sinnoh" })]
    [InlineData(GameVersion.PLA, new[] { "hisui" })]
    [InlineData(GameVersion.SL, new[] { "paldea", "kitakami", "blueberry" })]
    [InlineData(GameVersion.RD, new[] { "kanto" })]
    public void Pokedex_regionales_de_cada_juego(GameVersion version, string[] keys)
    {
        var dex = Blank(version).GetDex();
        Assert.Equal(keys, dex.Regions.Select(r => r.Key));
        Assert.All(dex.Regions, r =>
        {
            Assert.NotEmpty(r.Entries);
            Assert.Equal(r.Entries.Count, r.Entries.Select(e => e.Species).Distinct().Count());
        });
    }

    [Fact]
    public void Galar_tiene_400_y_empieza_por_Grookey()
    {
        var galar = Blank(GameVersion.SW).GetDex().Regions.First(r => r.Key == "galar");
        Assert.Equal(400, galar.Entries.Count);
        Assert.Equal((int)Species.Grookey, galar.Entries[0].Species);
    }
}
