using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>Fase 2: deshacer/rehacer, mochila, Pokédex e importar/exportar Pokémon.</summary>
public class Phase2Tests
{
    private static readonly SlotRef First = new(SlotRef.Party, 0, 0);

    private static SaveFile MakeBlank(GameVersion version)
    {
        var sav = BlankSaveFile.Get(version, "TESTER", LanguageID.Spanish);
        var pk = sav.BlankPKM;
        pk.Species = (ushort)Species.Pikachu;
        pk.Language = (int)LanguageID.Spanish;
        pk.CurrentLevel = 12;
        pk.OriginalTrainerName = "TESTER";
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, sav.Generation);
        pk.Move1 = (ushort)Move.Tackle;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);
        return sav;
    }

    private static SaveSession Open(GameVersion version = GameVersion.W)
    {
        var bytes = MakeBlank(version).Write(BinaryExportSetting.None).ToArray();
        Assert.True(SaveSession.TryOpen(bytes, null, out var s, out var e), e);
        return s!;
    }

    private static SaveSession Reopen(SaveSession s)
    {
        Assert.True(SaveSession.TryOpen(s.Export(), null, out var r, out var e), e);
        Assert.True(r!.Save.ChecksumsValid);
        return r;
    }

    private static void SetLevel(SaveSession s, int level)
    {
        var d = s.GetPokemon(First)!;
        Assert.True(s.SetPokemon(First, d.Edit with { Level = level }).Ok);
    }

    // ---------- Deshacer / rehacer ----------

    [Fact]
    public void Deshacer_y_rehacer()
    {
        var s = Open();
        var original = s.Export();
        Assert.False(s.History.CanUndo);

        SetLevel(s, 30);
        SetLevel(s, 40);
        Assert.Equal(2, s.History.Position);

        Assert.True(s.Undo());
        Assert.Equal(30, s.GetSummary().Party[0].Level);
        Assert.True(s.Undo());
        Assert.Equal(12, s.GetSummary().Party[0].Level);
        Assert.Equal(original, s.Export());
        Assert.False(s.Undo());

        Assert.True(s.Redo());
        Assert.True(s.Redo());
        Assert.Equal(40, s.GetSummary().Party[0].Level);
        Assert.False(s.Redo());
    }

    [Fact]
    public void Un_cambio_nuevo_borra_lo_que_se_podia_rehacer()
    {
        var s = Open();
        SetLevel(s, 30);
        s.Undo();
        Assert.True(s.History.CanRedo);
        SetLevel(s, 50);
        Assert.False(s.History.CanRedo);
        Assert.Equal(50, s.GetSummary().Party[0].Level);
    }

    [Fact]
    public void Un_cambio_invalido_no_entra_en_el_historial()
    {
        var s = Open();
        var d = s.GetPokemon(First)!;
        Assert.False(s.SetPokemon(First, d.Edit with { Level = 0 }).Ok);
        Assert.False(s.SetTrainer(new TrainerEdit("", 0)).Ok);
        Assert.Equal(0, s.History.Position);
    }

    [Fact]
    public void El_resumen_trae_el_historial()
    {
        var s = Open();
        Assert.True(s.SetTrainer(new TrainerEdit("Ash", 100)).Ok);
        var h = s.GetSummary().History;
        Assert.Equal(1, h.Position);
        Assert.True(h.CanUndo);
        Assert.False(h.CanRedo);
    }

    // ---------- Mochila ----------

    [Fact]
    public void Mochila_editar_un_bolsillo_y_exportar()
    {
        var s = Open();
        var pouch = s.GetBag().Pouches.First(p => p.Type == "Medicine");
        var a = pouch.Allowed[0];
        var b = pouch.Allowed[1];

        var r = s.SetPouch(new PouchEdit("Medicine", [new BagItemEdit(a.Id, 5), new BagItemEdit(b.Id, 99)]));
        Assert.True(r.Ok, r.Error);

        var after = Reopen(s).GetBag().Pouches.First(p => p.Type == "Medicine");
        Assert.Equal(2, after.Items.Count);
        Assert.Contains(after.Items, i => i.Id == a.Id && i.Count == 5);
        Assert.Contains(after.Items, i => i.Id == b.Id && i.Count == 99);
    }

    [Fact]
    public void Mochila_vaciar_un_bolsillo()
    {
        var s = Open();
        var id = s.GetBag().Pouches.First(p => p.Type == "Items").Allowed[0].Id;
        Assert.True(s.SetPouch(new PouchEdit("Items", [new BagItemEdit(id, 3)])).Ok);
        Assert.True(s.SetPouch(new PouchEdit("Items", [])).Ok);
        Assert.Empty(s.GetBag().Pouches.First(p => p.Type == "Items").Items);
    }

    [Fact]
    public void Mochila_validacion()
    {
        var s = Open();
        var bag = s.GetBag();
        var medicine = bag.Pouches.First(p => p.Type == "Medicine");
        int medId = medicine.Allowed[0].Id;
        int keyId = bag.Pouches.First(p => p.Type == "KeyItems").Allowed[0].Id;
        var before = s.Export();

        Assert.Equal("pouch", s.SetPouch(new PouchEdit("NoExiste", [])).Error);
        Assert.Equal("bag-item", s.SetPouch(new PouchEdit("Medicine", [new BagItemEdit(keyId, 1)])).Error);
        Assert.Equal("bag-count", s.SetPouch(new PouchEdit("Medicine", [new BagItemEdit(medId, 100_000)])).Error);
        Assert.Equal("bag-duplicate", s.SetPouch(new PouchEdit("Medicine", [new BagItemEdit(medId, 1), new BagItemEdit(medId, 2)])).Error);
        var tooMany = medicine.Allowed.Take(medicine.Slots + 1).Select(o => new BagItemEdit(o.Id, 1)).ToList();
        if (tooMany.Count > medicine.Slots)
            Assert.Equal("pouch-full", s.SetPouch(new PouchEdit("Medicine", tooMany)).Error);

        Assert.Equal(before, s.Export());
        Assert.Equal(0, s.History.Position);
    }

    [Fact]
    public void Mochila_se_puede_deshacer()
    {
        var s = Open();
        var id = s.GetBag().Pouches.First(p => p.Type == "Berries").Allowed[0].Id;
        Assert.True(s.SetPouch(new PouchEdit("Berries", [new BagItemEdit(id, 10)])).Ok);
        s.Undo();
        Assert.Empty(s.GetBag().Pouches.First(p => p.Type == "Berries").Items);
    }

    // ---------- Pokédex ----------

    [Theory]
    [InlineData(GameVersion.W)]
    [InlineData(GameVersion.B2)]
    [InlineData(GameVersion.X)]
    [InlineData(GameVersion.RD)]
    [InlineData(GameVersion.C)]
    public void Pokedex_marcar_y_desmarcar(GameVersion version)
    {
        var s = version is GameVersion.W or GameVersion.B2 ? Open(version) : SaveSession.FromSave(MakeBlank(version));
        Assert.True(s.GetDex().Editable);

        Assert.True(s.SetDex(new DexEdit([1, 4], Seen: true, Caught: true)).Ok);
        Assert.True(s.SetDex(new DexEdit([7], Seen: true, Caught: false)).Ok);
        var dex = s.GetDex().Entries.ToDictionary(e => e.Species);
        Assert.True(dex[1].Caught && dex[1].Seen);
        Assert.True(dex[4].Caught);
        Assert.True(dex[7].Seen && !dex[7].Caught);

        Assert.True(s.SetDex(new DexEdit([1], Seen: false, Caught: false)).Ok);
        dex = s.GetDex().Entries.ToDictionary(e => e.Species);
        Assert.False(dex[1].Seen || dex[1].Caught);
    }

    [Fact]
    public void Pokedex_completar_entera_y_sobrevive_a_exportar()
    {
        var s = Open(GameVersion.W);
        Assert.True(s.SetDex(new DexEdit([], Seen: true, Caught: true)).Ok);
        var summary = Reopen(s).GetSummary();
        Assert.Equal(649, summary.Pokedex!.Caught);
        Assert.Equal(649, summary.Pokedex.Seen);
    }

    [Fact]
    public void Pokedex_no_editable_en_juegos_nuevos()
    {
        var s = SaveSession.FromSave(MakeBlank(GameVersion.SW));
        Assert.False(s.GetDex().Editable);
        Assert.Equal("dex-unsupported", s.SetDex(new DexEdit([25], true, true)).Error);
    }

    // ---------- Exportar / importar .pk* ----------

    [Fact]
    public void Exportar_e_importar_pk_del_mismo_juego()
    {
        var s = Open();
        var d = s.GetPokemon(First)!;
        Assert.True(s.SetPokemon(First, d.Edit with { Level = 42, IsNicknamed = true, Nickname = "Chispa" }).Ok);

        var export = s.ExportPokemon(First);
        Assert.NotNull(export);
        Assert.EndsWith(".pk5", export!.Value.Info.FileName);
        Assert.Contains("Pikachu", export.Value.Info.Showdown);

        var box = new SlotRef(SlotRef.BoxKind, 2, 7);
        var r = s.ImportPokemonFile(box, export.Value.Data, export.Value.Info.FileName);
        Assert.True(r.Ok, r.Error);

        var imported = Reopen(s).GetPokemon(box)!;
        Assert.Equal((int)Species.Pikachu, imported.Edit.Species);
        Assert.Equal(42, imported.Edit.Level);
        Assert.Equal("Chispa", imported.Edit.Nickname);
    }

    [Fact]
    public void Importar_pk4_en_blanco_lo_convierte()
    {
        var s = Open();
        var pk4 = new PK4 { Species = (ushort)Species.Turtwig, CurrentLevel = 20, Move1 = (ushort)Move.Tackle, Language = (int)LanguageID.English, OriginalTrainerName = "OLD" };
        pk4.Nickname = SpeciesName.GetSpeciesName(pk4.Species, pk4.Language);
        pk4.RefreshChecksum();
        var data = pk4.Data.ToArray();

        var box = new SlotRef(SlotRef.BoxKind, 0, 0);
        var r = s.ImportPokemonFile(box, data, "turtwig.pk4");
        Assert.True(r.Ok, r.Error);
        Assert.Equal((int)Species.Turtwig, r.Pokemon!.Edit.Species);
        Assert.IsType<PK5>(s.Save.GetBoxSlotAtIndex(0, 0));
    }

    [Fact]
    public void Importar_al_equipo_lo_anade_al_final()
    {
        var s = Open();
        var export = s.ExportPokemon(First)!.Value;
        var r = s.ImportPokemonFile(new SlotRef(SlotRef.Party, 0, 5), export.Data, export.Info.FileName);
        Assert.True(r.Ok, r.Error);
        Assert.Equal(2, s.GetSummary().Party.Count);
        Assert.Equal(1, r.Pokemon!.Ref.Slot);
    }

    [Fact]
    public void Importar_archivo_basura_da_error()
    {
        var s = Open();
        var junk = new byte[136];
        new Random(1).NextBytes(junk);
        var r = s.ImportPokemonFile(new SlotRef(SlotRef.BoxKind, 0, 0), junk, "basura.pk5");
        Assert.False(r.Ok);
        Assert.StartsWith("pk-", r.Error);
        Assert.False(s.ImportPokemonFile(new SlotRef(SlotRef.BoxKind, 0, 0), [1, 2, 3], "x.txt").Ok);
        Assert.Equal(0, s.History.Position);
    }

    [Fact]
    public void Importar_en_hueco_imposible_da_error()
    {
        var s = Open();
        var export = s.ExportPokemon(First)!.Value;
        Assert.Equal("slot", s.ImportPokemonFile(new SlotRef(SlotRef.Party, 0, 6), export.Data, "a.pk5").Error);
        Assert.Equal("slot", s.ImportPokemonFile(new SlotRef(SlotRef.Party, 0, -1), export.Data, "a.pk5").Error);
        Assert.Equal("slot", s.ImportPokemonFile(new SlotRef(SlotRef.BoxKind, 99, 0), export.Data, "a.pk5").Error);
    }

    // ---------- Showdown ----------

    private const string Garchomp = """
        Garchomp @ Choice Scarf
        Ability: Rough Skin
        Level: 50
        Shiny: Yes
        EVs: 252 Atk / 4 SpD / 252 Spe
        Jolly Nature
        - Earthquake
        - Dragon Claw
        - Stone Edge
        - Fire Fang
        """;

    [Fact]
    public void Importar_desde_Showdown()
    {
        var s = Open();
        var box = new SlotRef(SlotRef.BoxKind, 1, 0);
        var r = s.ImportShowdown(box, Garchomp);
        Assert.True(r.Ok, r.Error);

        var p = Reopen(s).GetPokemon(box)!;
        Assert.Equal((int)Species.Garchomp, p.Edit.Species);
        Assert.Equal(50, p.Edit.Level);
        Assert.True(p.Edit.IsShiny);
        Assert.Equal((int)Nature.Jolly, p.Edit.Nature);
        Assert.Equal([(int)Move.Earthquake, (int)Move.DragonClaw, (int)Move.StoneEdge, (int)Move.FireFang], p.Edit.Moves);
        Assert.Equal(252, p.Edit.EVs[1]);
        Assert.Equal("TESTER", s.Save.GetBoxSlotAtIndex(1, 0).OriginalTrainerName);
    }

    [Fact]
    public void Showdown_ida_y_vuelta()
    {
        var s = Open();
        var box = new SlotRef(SlotRef.BoxKind, 1, 0);
        Assert.True(s.ImportShowdown(box, Garchomp).Ok);
        var text = s.ExportPokemon(box)!.Value.Info.Showdown;
        Assert.Contains("Garchomp", text);
        Assert.Contains("Earthquake", text);
        Assert.Contains("Jolly Nature", text);
    }

    [Theory]
    [InlineData("")]
    [InlineData("esto no es un pokémon")]
    public void Showdown_invalido_da_error(string text)
    {
        var s = Open();
        Assert.Equal("showdown", s.ImportShowdown(new SlotRef(SlotRef.BoxKind, 0, 0), text).Error);
    }

    [Fact]
    public void Showdown_de_especie_que_no_existe_en_el_juego()
    {
        var s = Open(); // Blanco: hasta Genesect (#649)
        var r = s.ImportShowdown(new SlotRef(SlotRef.BoxKind, 0, 0), "Sprigatito\n- Scratch");
        Assert.Equal("pk-species", r.Error);
        // Antes acababa convertido en Genesect sin avisar.
        Assert.Equal(0, s.Save.GetBoxSlotAtIndex(0, 0).Species);
    }
}
