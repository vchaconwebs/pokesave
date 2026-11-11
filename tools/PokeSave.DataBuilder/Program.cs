// Genera web/public/data/games/<juego>.json para el asistente de Pokédex a partir de las
// tablas de encuentros de PKHeX.Core (las mismas que usa para la legalidad, sacadas de los
// archivos de cada juego). Uso: dotnet run --project tools/PokeSave.DataBuilder
//
// Las tablas son internas de PKHeX: se leen por reflexión. Si una versión nueva de PKHeX
// cambia un nombre, el programa falla avisando de qué tabla falta.
using System.Reflection;
using System.Text.Json;
using PKHeX.Core;

var root = FindRoot();
var outDir = Path.Combine(root, "web", "public", "data", "games");
Directory.CreateDirectory(outDir);

var es = GameInfo.GetStrings("es");
var en = GameInfo.GetStrings("en");
var asm = typeof(PKM).Assembly;

var groups = new Group[]
{
    new("rby", 1, [GameVersion.RD, GameVersion.GN, GameVersion.YW], ["Encounters1"], EvolutionTree.Evolves1, PersonalTable.Y, GameVersion.RD),
    new("gsc", 2, [GameVersion.GD, GameVersion.SI, GameVersion.C], ["Encounters2"], EvolutionTree.Evolves2, PersonalTable.C, GameVersion.C),
    new("rse", 3, [GameVersion.R, GameVersion.S, GameVersion.E], ["Encounters3RSE"], EvolutionTree.Evolves3, PersonalTable.E, GameVersion.E),
    new("frlg", 3, [GameVersion.FR, GameVersion.LG], ["Encounters3FRLG"], EvolutionTree.Evolves3, PersonalTable.FR, GameVersion.FR),
    new("dppt", 4, [GameVersion.D, GameVersion.P, GameVersion.Pt], ["Encounters4DPPt"], EvolutionTree.Evolves4, PersonalTable.Pt, GameVersion.Pt),
    new("hgss", 4, [GameVersion.HG, GameVersion.SS], ["Encounters4HGSS"], EvolutionTree.Evolves4, PersonalTable.HGSS, GameVersion.HG),
    new("b2w2", 5, [GameVersion.B2, GameVersion.W2], ["Encounters5B2W2"], EvolutionTree.Evolves5, PersonalTable.B2W2, GameVersion.B2),
    new("xy", 6, [GameVersion.X, GameVersion.Y], ["Encounters6XY"], EvolutionTree.Evolves6, PersonalTable.XY, GameVersion.X),
    new("oras", 6, [GameVersion.OR, GameVersion.AS], ["Encounters6AO"], EvolutionTree.Evolves6, PersonalTable.AO, GameVersion.OR),
    new("sm", 7, [GameVersion.SN, GameVersion.MN], ["Encounters7SM"], EvolutionTree.Evolves7, PersonalTable.SM, GameVersion.SN),
    new("usum", 7, [GameVersion.US, GameVersion.UM], ["Encounters7USUM"], EvolutionTree.Evolves7, PersonalTable.USUM, GameVersion.US),
    new("lgpe", 7, [GameVersion.GP, GameVersion.GE], ["Encounters7GG"], EvolutionTree.Evolves7b, PersonalTable.GG, GameVersion.GP),
    new("swsh", 8, [GameVersion.SW, GameVersion.SH], ["Encounters8", "Encounters8Nest"], EvolutionTree.Evolves8, PersonalTable.SWSH, GameVersion.SW),
    new("bdsp", 8, [GameVersion.BD, GameVersion.SP], ["Encounters8b"], EvolutionTree.Evolves8b, PersonalTable.BDSP, GameVersion.BD),
    new("pla", 8, [GameVersion.PLA], ["Encounters8a"], EvolutionTree.Evolves8a, PersonalTable.LA, GameVersion.PLA),
    new("sv", 9, [GameVersion.SL, GameVersion.VL], ["Encounters9"], EvolutionTree.Evolves9, PersonalTable.SV, GameVersion.SL),
    new("za", 9, [GameVersion.ZA], ["Encounters9a"], EvolutionTree.Evolves9a, PersonalTable.ZA, GameVersion.ZA),
};

// Tablas que no son del juego normal: eventos, Pokémon GO, Mundo Sueño, discos extra…
string[] skipFields = ["Dist", "Might", "Outbreak", "DreamWorld", "ColoGifts", "TradeNames", "Fixed"];

var only = args.Length > 0 ? args.ToHashSet() : null;
foreach (var g in groups)
{
    if (only is not null && !only.Contains(g.Key))
        continue;
    var data = Build(g);
    var file = Path.Combine(outDir, g.Key + ".json");
    File.WriteAllText(file, JsonSerializer.Serialize(data, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }));
    Console.WriteLine($"{g.Key,-5} {data.Locations.Count,4} lugares, {data.Species.Count(s => s.Value.Enc is not null),4} especies con encuentros, {new FileInfo(file).Length / 1024,4} KB  métodos: {string.Join(",", data.Methods)}");
}

// Nombres de los lugares de Gen 3 (número de sección del mapa) para el buscador de objetos
// (web/public/data/items/*.json, lo genera tools/build-gen3-items.mjs).
if (only is null || only.Contains("locations"))
{
    var itemsDir = Path.Combine(root, "web", "public", "data", "items");
    Directory.CreateDirectory(itemsDir);
    var g3 = new List<LocationName>();
    for (ushort i = 0; i < 213; i++)
        g3.Add(new LocationName(es.GetLocationName(false, i, 3, 3, GameVersion.E), en.GetLocationName(false, i, 3, 3, GameVersion.E)));
    File.WriteAllText(Path.Combine(itemsDir, "gen3-locations.json"), JsonSerializer.Serialize(g3));
    Console.WriteLine($"gen3-locations: {g3.Count} lugares (p. ej. {g3[16].Es} / {g3[88].Es})");

    // Gen 2: el lugar de captura es el "landmark" del mapa (pret: constants/landmark_constants.asm).
    var g2 = new List<LocationName>();
    for (ushort i = 0; i < 128; i++)
        g2.Add(new LocationName(es.GetLocationName(false, i, 2, 2, GameVersion.C), en.GetLocationName(false, i, 2, 2, GameVersion.C)));
    File.WriteAllText(Path.Combine(itemsDir, "gen2-locations.json"), JsonSerializer.Serialize(g2));
    Console.WriteLine($"gen2-locations: {g2.Count} lugares (p. ej. {g2[1].Es} / {g2[2].Es})");
}

GameData Build(Group g)
{
    var locations = new List<LocationName>();
    var locIndex = new Dictionary<string, int>();
    int Loc(string key, string nameEs, string nameEn)
    {
        if (!locIndex.TryGetValue(key, out var i))
        {
            locIndex[key] = i = locations.Count;
            locations.Add(new LocationName(nameEs, nameEn, int.TryParse(key, out var id) ? id : null));
        }
        return i;
    }

    var enc = new Dictionary<ushort, Dictionary<(int Loc, string Method, byte Form), int[]>>();
    var methods = new SortedSet<string>();

    void Add(object t, string method, int vmask, ushort? locationOverride = null, string? locKeyOverride = null, string? locEs = null, string? locEn = null)
    {
        ushort species = Get<ushort>(t, "Species");
        if (species == 0 || vmask == 0)
            return;
        byte form = Get<byte>(t, "Form");
        if (!g.Personal.IsPresentInGame(species, form) && g.Gen >= 3)
            return;
        byte min = Get<byte>(t, "LevelMin");
        byte max = Get<byte>(t, "LevelMax");
        int loc;
        if (locKeyOverride is not null)
        {
            loc = Loc(locKeyOverride, locEs!, locEn!);
        }
        else
        {
            ushort location = locationOverride ?? Get<ushort>(t, "Location");
            var nEs = LocationNameOf(es, location, g);
            var nEn = LocationNameOf(en, location, g);
            loc = Loc($"{location}", nEs, nEn);
        }
        methods.Add(method);
        if (!enc.TryGetValue(species, out var list))
            enc[species] = list = [];
        var key = (loc, method, form);
        if (list.TryGetValue(key, out var e))
        {
            e[0] = Math.Min(e[0], min);
            e[1] = Math.Max(e[1], max);
            e[2] |= vmask;
        }
        else
        {
            list[key] = [min, max, vmask];
        }
    }

    foreach (var typeName in g.Tables)
    {
        var type = asm.GetType("PKHeX.Core." + typeName) ?? throw new InvalidOperationException($"Falta la tabla {typeName} en PKHeX");
        foreach (var f in type.GetFields(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
        {
            if (!f.FieldType.IsArray || skipFields.Any(s => f.Name.Contains(s)))
                continue;
            if (f.GetValue(null) is not Array arr || arr.Length == 0 || arr.GetValue(0) is string or string[])
                continue;
            foreach (var item in arr)
            {
                if (item is null)
                    continue;
                if (item.GetType().GetProperty("Slots") is { } slotsProp)
                {
                    var areaType = TypeName(item) ?? (f.Name.Contains("_UG") ? "underground" : f.Name.Contains("Hidden") ? "Hidden" : f.Name.Contains("Hyperspace") ? "hyperspace" : "wild");
                    foreach (var slot in ((Array)slotsProp.GetValue(item)!).Cast<object>())
                    {
                        var method = Normalize(TypeName(slot) ?? areaType);
                        Add(slot, method, Mask(g, Get<GameVersion>(slot!, "Version") is var v && v != 0 ? v : Get<GameVersion>(item, "Version")));
                    }
                    continue;
                }
                AddTemplate(item, f.Name);
            }
        }
    }

    void AddTemplate(object t, string field)
    {
        var cls = t.GetType().Name;
        var version = Get<GameVersion>(t, "Version");
        int mask = Mask(g, version == 0 ? g.Versions[0] : version);
        if (cls.StartsWith("EncounterTera9"))
        {
            // Teraincursiones: no tienen lugar, sino zona (Paldea, Noroteo, Arándano).
            mask = (Get<bool>(t, "IsAvailableHostScarlet") ? 1 : 0) | (Get<bool>(t, "IsAvailableHostViolet") ? 2 : 0);
            var map = Get<object>(t, "Map")?.ToString() ?? "Paldea";
            var stars = Get<byte>(t, "Stars");
            var (mapEs, mapEn) = map switch { "Kitakami" => ("Noroteo", "Kitakami"), "Blueberry" => ("Academia Arándano", "Blueberry Academy"), _ => ("Paldea", "Paldea") };
            Add(t, $"tera-{stars}", mask, locKeyOverride: $"tera-{map}", locEs: $"Teraincursiones de {mapEs}", locEn: $"{mapEn} Tera Raids");
            return;
        }
        if (cls.StartsWith("EncounterStatic8N") || cls.StartsWith("EncounterStatic8U"))
        {
            bool adventure = cls.StartsWith("EncounterStatic8U");
            Add(t, adventure ? "dynamax-adventure" : "max-raid", mask,
                locKeyOverride: adventure ? "max-lair" : "max-raid",
                locEs: adventure ? "Guarida Dinamax (Nieves de la Corona)" : "Incursiones Dinamax",
                locEn: adventure ? "Max Lair (Crown Tundra)" : "Max Raid Battles");
            return;
        }
        if (cls.Contains("Pokewalker"))
        {
            Add(t, "pokewalker", mask, locKeyOverride: "pokewalker", locEs: "Pokéwalker", locEn: "Pokéwalker");
            return;
        }
        if (cls.Contains("Trade"))
        {
            Add(t, "trade", mask, locKeyOverride: "trade", locEs: "Intercambio en el juego", locEn: "In-game trade");
            return;
        }
        if (cls.Contains("Radar") || cls.Contains("Entree") || cls.Contains("Gift3") || cls.Contains("Ranch"))
            return;
        string method;
        if (Get<bool>(t, "IsEgg"))
            method = "gift-egg";
        else if (Get<bool>(t, "IsRoaming"))
            method = "roaming";
        else if (g.Gen <= 2)
            method = "static";
        else if (t.GetType().GetProperty("Gift") is { } gift)
            method = (bool)gift.GetValue(t)! ? "gift" : "static";
        else
            method = Get<object>(t, "FixedBall")?.ToString() is "Poke" or "Premier" or "Cherish" ? "gift" : "static";
        Add(t, method, mask);
    }

    // ---------- Evoluciones (del propio juego) ----------
    var evo = new Dictionary<ushort, EvoInfo>();
    var forward = g.Evo.Forward;
    for (ushort s = 1; s <= g.Personal.MaxSpeciesID; s++)
    {
        if (!InGame(g, s))
            continue;
        foreach (var m in forward.GetForward(s, 0).Span)
        {
            if (m.Species == 0 || !InGame(g, m.Species) || evo.ContainsKey(m.Species))
                continue;
            evo[m.Species] = Describe(m, s);
        }
    }

    if (g.Key == "sv")
        ApplyExclusivesSV(enc, methods);

    var methodList = methods.ToList();
    var species = new Dictionary<string, SpeciesInfo>();
    for (ushort s = 1; s <= g.Personal.MaxSpeciesID; s++)
    {
        if (!InGame(g, s))
            continue;
        int[][]? list = null;
        if (enc.TryGetValue(s, out var e))
        {
            list = e.OrderBy(x => x.Key.Loc).ThenBy(x => x.Key.Method)
                .Select(x => new[] { x.Key.Loc, MethodIndex(x.Key.Method), x.Value[0], x.Value[1], x.Value[2], x.Key.Form })
                .ToArray();
        }
        Dictionary<string, string>? forms = null;
        foreach (var f in list?.Select(x => (byte)x[5]).Where(f => f != 0).Distinct() ?? [])
        {
            forms ??= [];
            forms[f.ToString()] = FormName(es, s, f) + "|" + FormName(en, s, f);
        }
        species[s.ToString()] = new SpeciesInfo(
            list,
            forms,
            evo.TryGetValue(s, out var ev) ? ev : null,
            SpeciesCategory.IsMythical(s) ? 1 : null,
            SpeciesCategory.IsLegendary(s) || SpeciesCategory.IsSubLegendary(s) ? 1 : null);
    }

    int MethodIndex(string m) => methodList.IndexOf(m);
    string FormName(GameStrings str, ushort sp, byte form)
    {
        var names = FormConverter.GetFormList(sp, str.types, str.forms, GameInfo.GenderSymbolUnicode, g.Context);
        return form < names.Length ? names[form] : $"#{form}";
    }
    return new GameData(1, g.Key, g.Versions.Select(v => v.ToString()).ToList(), methodList, locations, species,
        "PKHeX.Core " + typeof(PKM).Assembly.GetName().Version);

    EvoInfo Describe(EvolutionMethod m, ushort from)
    {
        var type = m.Method.ToString();
        string? item = null;
        string? move = null;
        int? with = null;
        // El significado de Argument depende del tipo (objeto, movimiento, especie…).
        if (type.Contains("Item") || type.Contains("Held") || type is "TradeHeldItem")
            item = m.Argument == 0 ? null : es.itemlist[m.Argument] + "|" + en.itemlist[m.Argument];
        else if (type.Contains("Move") && !type.Contains("Type"))
            move = m.Argument == 0 ? null : es.movelist[m.Argument] + "|" + en.movelist[m.Argument];
        else if (type.Contains("TradeSpecies") || type == "LevelUpWithTeammate")
            with = m.Argument == 0 ? null : m.Argument;
        return new EvoInfo(from, type, m.Level == 0 ? null : m.Level, item, move, with);
    }
}

// En SV, PKHeX junta las dos versiones en los encuentros salvajes (por el Círculo Unión se
// pueden capturar los de la otra). Exclusivos según thonky.com/pokemon-scarlet-violet/version-exclusives
// (juego base, El disco índigo y La máscara turquesa). (especie, forma o -1 = todas) → 1 Escarlata, 2 Púrpura.
static void ApplyExclusivesSV(Dictionary<ushort, Dictionary<(int Loc, string Method, byte Form), int[]>> enc, SortedSet<string> methods)
{
    var only = new Dictionary<(ushort, int), int>
    {
        // Escarlata
        [(128, 2)] = 1, [(246, -1)] = 1, [(247, -1)] = 1, [(248, -1)] = 1, [(425, -1)] = 1, [(426, -1)] = 1,
        [(434, -1)] = 1, [(435, -1)] = 1, [(633, -1)] = 1, [(634, -1)] = 1, [(635, -1)] = 1, [(690, -1)] = 1,
        [(691, -1)] = 1, [(765, -1)] = 1, [(874, -1)] = 1, [(984, -1)] = 1, [(986, -1)] = 1, [(989, -1)] = 1,
        [(985, -1)] = 1, [(987, -1)] = 1, [(988, -1)] = 1, [(1005, -1)] = 1, [(936, -1)] = 1,
        [(207, -1)] = 1, [(472, -1)] = 1, [(845, -1)] = 1, // La máscara turquesa
        [(37, 1)] = 1, [(38, 1)] = 1, [(408, -1)] = 1, [(409, -1)] = 1, [(1020, -1)] = 1, [(1021, -1)] = 1, // El disco índigo
        // Púrpura
        [(128, 3)] = 2, [(371, -1)] = 2, [(372, -1)] = 2, [(373, -1)] = 2, [(200, -1)] = 2, [(429, -1)] = 2,
        [(316, -1)] = 2, [(317, -1)] = 2, [(885, -1)] = 2, [(886, -1)] = 2, [(887, -1)] = 2, [(692, -1)] = 2,
        [(693, -1)] = 2, [(766, -1)] = 2, [(875, -1)] = 2, [(990, -1)] = 2, [(994, -1)] = 2, [(992, -1)] = 2,
        [(993, -1)] = 2, [(995, -1)] = 2, [(991, -1)] = 2, [(1006, -1)] = 2, [(937, -1)] = 2,
        [(190, -1)] = 2, [(424, -1)] = 2, [(877, -1)] = 2,
        [(27, 1)] = 2, [(28, 1)] = 2, [(410, -1)] = 2, [(411, -1)] = 2, [(1022, -1)] = 2, [(1023, -1)] = 2,
    };
    foreach (var (species, list) in enc)
    {
        foreach (var key in list.Keys.ToList())
        {
            if (key.Method != "wild")
                continue;
            if (only.TryGetValue((species, key.Form), out var m) || only.TryGetValue((species, -1), out m))
                list[key][2] = m;
        }
    }
}

static int Mask(Group g, GameVersion v)
{
    int mask = 0;
    for (int i = 0; i < g.Versions.Length; i++)
    {
        if (v == g.Versions[i] || v.Contains(g.Versions[i]))
            mask |= 1 << i;
    }
    return mask;
}

static bool InGame(Group g, ushort s) => g.Gen <= 2 ? s <= g.Personal.MaxSpeciesID : g.Personal.IsSpeciesInGame(s);

static string LocationNameOf(GameStrings strings, ushort location, Group g)
{
    var name = strings.GetLocationName(false, location, g.Gen, g.Gen, g.LocVersion);
    return string.IsNullOrWhiteSpace(name) || name == "----" ? $"#{location}" : name;
}

static string? TypeName(object o)
{
    var p = o.GetType().GetProperty("Type");
    var v = p?.GetValue(o);
    return v?.ToString();
}

static string Normalize(string type)
{
    var t = type.Replace('_', '-').ToLowerInvariant().TrimEnd('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
    return t switch
    {
        "swarmgrass" => "swarm",
        "swarmfish" => "swarm-fish",
        "symbolmain" => "symbol",
        "hiddenmain" => "hidden",
        "massoutbreakregular" or "massoutbreakmassive" => "outbreak",
        "headbuttspecial" => "headbutt",
        "bugcontest" => "bug-contest",
        "honeytree" => "honey-tree",
        "hiddengrotto" => "hidden-grotto",
        "friendsafari" => "friend-safari",
        "onlyfishing" => "fishing",
        _ => t,
    };
}

static T Get<T>(object o, string name)
{
    var p = o.GetType().GetProperty(name);
    if (p is null)
        return default!;
    var v = p.GetValue(o);
    if (v is null)
        return default!;
    if (v is T t)
        return t;
    return (T)Convert.ChangeType(v, typeof(T));
}

static string FindRoot()
{
    var dir = AppContext.BaseDirectory;
    while (!File.Exists(Path.Combine(dir, "PokeSave.slnx")))
        dir = Path.GetDirectoryName(dir) ?? throw new InvalidOperationException("No encuentro la raíz del repositorio");
    return dir;
}

sealed record Group(string Key, byte Gen, GameVersion[] Versions, string[] Tables, EvolutionTree Evo, IPersonalTable Personal, GameVersion LocVersion)
{
    public EntityContext Context => Key switch
    {
        "lgpe" => EntityContext.Gen7b,
        "bdsp" => EntityContext.Gen8b,
        "pla" => EntityContext.Gen8a,
        "za" => EntityContext.Gen9a,
        _ => (EntityContext)Gen,
    };
}

sealed record LocationName(string Es, string En, int? Id = null);

sealed record EvoInfo(ushort From, string T, byte? Lvl, string? Item, string? Move, int? With);

sealed record SpeciesInfo(int[][]? Enc, Dictionary<string, string>? Forms, EvoInfo? Evo, int? Event, int? Legend);

sealed record GameData(int Version, string Game, List<string> Versions, List<string> Methods, List<LocationName> Locations, Dictionary<string, SpeciesInfo> Species, string Source);
