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

    [JSExport]
    public static string PkhexVersion()
        => typeof(PKHeX.Core.SaveFile).Assembly.GetName().Version?.ToString() ?? "?";

    private static string Serialize(LoadResult result)
        => JsonSerializer.Serialize(result, PokeSaveJson.Default.LoadResult);
}
