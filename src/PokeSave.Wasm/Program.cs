using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;
using PokeSave.Core;

// El motor no tiene interfaz propia: solo arranca el runtime y espera llamadas desde JS.
return;

/// <summary>
/// Funciones que ve el frontend (TypeScript). Todo viaja como JSON o bytes; la partida
/// se queda en la memoria del navegador y nunca se envía a ningún sitio.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class Engine
{
    private static SaveSession? _session;

    [JSExport]
    public static string Load(byte[] data, string fileName, string language)
    {
        if (!SaveSession.TryOpen(data, fileName, out var session, out var error))
        {
            _session = null;
            return Serialize(new LoadResult(false, error, null));
        }

        _session = session;
        return Serialize(new LoadResult(true, null, session!.GetSummary(language)));
    }

    /// <summary>Vuelve a generar el resumen (por ejemplo, al cambiar de idioma).</summary>
    [JSExport]
    public static string Summary(string language)
        => _session is null
            ? Serialize(new LoadResult(false, "none", null))
            : Serialize(new LoadResult(true, null, _session.GetSummary(language)));

    /// <summary>Partida exportada con checksums recalculados.</summary>
    [JSExport]
    public static byte[] Export()
        => _session?.Export() ?? throw new InvalidOperationException("No hay ninguna partida cargada.");

    /// <summary>Bytes originales, sin tocar, para la copia de seguridad.</summary>
    [JSExport]
    public static byte[] ExportOriginal()
        => _session?.Original.ToArray() ?? throw new InvalidOperationException("No hay ninguna partida cargada.");

    // ---------- Fase 1: edición ----------

    [JSExport]
    public static string Lists(string language)
        => _session is null ? "null" : JsonSerializer.Serialize(_session.GetLists(language), PokeSaveJson.Default.GameLists);

    [JSExport]
    public static string Box(int box, string language)
    {
        var view = _session?.GetBox(box, language);
        return view is null ? "null" : JsonSerializer.Serialize(view, PokeSaveJson.Default.BoxView);
    }

    [JSExport]
    public static string Pokemon(string slotJson, string language)
    {
        var at = Parse(slotJson, PokeSaveJson.Default.SlotRef);
        var detail = at is null ? null : _session?.GetPokemon(at, language);
        return detail is null ? "null" : JsonSerializer.Serialize(detail, PokeSaveJson.Default.PokemonDetail);
    }

    [JSExport]
    public static string SetPokemon(string slotJson, string editJson, string language)
    {
        var at = Parse(slotJson, PokeSaveJson.Default.SlotRef);
        var edit = Parse(editJson, PokeSaveJson.Default.PokemonEdit);
        var result = _session is null || at is null || edit is null
            ? new EditResult(false, "input", null, null)
            : _session.SetPokemon(at, edit, language);
        return JsonSerializer.Serialize(result, PokeSaveJson.Default.EditResult);
    }

    [JSExport]
    public static string PreviewPokemon(string slotJson, string editJson, string language)
    {
        var at = Parse(slotJson, PokeSaveJson.Default.SlotRef);
        var edit = Parse(editJson, PokeSaveJson.Default.PokemonEdit);
        var result = _session is null || at is null || edit is null
            ? new EditResult(false, "input", null, null)
            : _session.PreviewPokemon(at, edit, language);
        return JsonSerializer.Serialize(result, PokeSaveJson.Default.EditResult);
    }

    [JSExport]
    public static string SetTrainer(string editJson, string language)
    {
        var edit = Parse(editJson, PokeSaveJson.Default.TrainerEdit);
        var result = _session is null || edit is null
            ? new EditResult(false, "input", null, null)
            : _session.SetTrainer(edit, language);
        return JsonSerializer.Serialize(result, PokeSaveJson.Default.EditResult);
    }

    private static T? Parse<T>(string json, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> type) where T : class
    {
        try
        {
            return JsonSerializer.Deserialize(json, type);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    [JSExport]
    public static string PkhexVersion()
        => typeof(PKHeX.Core.SaveFile).Assembly.GetName().Version?.ToString() ?? "?";

    private static string Serialize(LoadResult result)
        => JsonSerializer.Serialize(result, PokeSaveJson.Default.LoadResult);
}
