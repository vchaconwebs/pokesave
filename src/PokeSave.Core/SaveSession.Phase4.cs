using PKHeX.Core;

namespace PokeSave.Core;

/// <summary>
/// Fase 4: buscador de objetos y MT. Lista todos los objetos del juego con cuántos tienes
/// (mochila + PC), qué MT/MO son y qué movimiento enseñan. Los datos de dónde se consigue cada
/// objeto los pone la web (public/data/items/*.json); el motor solo lee los flags de evento
/// para saber cuáles has recogido.
/// </summary>
public sealed partial class SaveSession
{
    public ItemFinderView GetItemFinder(string language = "es")
    {
        var names = ItemNames(language);
        var strings = GameInfo.GetStrings(language);
        var counts = new Dictionary<int, int>();
        var pouchOf = new Dictionary<int, string>();
        var bag = Safe(() => Save.Inventory);
        if (bag is not null)
        {
            foreach (var pouch in bag.Pouches)
            {
                if (pouch.Type is InventoryType.None or InventoryType.FreeSpace)
                    continue;
                bool pc = pouch.Type == InventoryType.PCItems;
                foreach (var id in pouch.GetAllItems())
                {
                    if (id != 0 && !pc)
                        pouchOf.TryAdd(id, pouch.Type.ToString());
                }
                foreach (var it in pouch.Items)
                {
                    if (it.Index != 0 && it.Count > 0)
                        counts[it.Index] = counts.GetValueOrDefault(it.Index) + it.Count;
                }
            }
        }

        var machines = Machines();
        var items = new List<FinderItem>();
        foreach (var (id, pouch) in pouchOf)
        {
            var name = Get(names, id);
            if (name is null or "(?)" or "???")
                continue;
            int? move = machines.TryGetValue(id, out var m) ? m : null;
            items.Add(new FinderItem(
                id, name, pouch, counts.GetValueOrDefault(id),
                move,
                move is { } mv ? Get(strings.movelist, mv) : null,
                move is { } mt ? MoveInfo.GetType((ushort)mt, Save.Context) : null));
        }
        items.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.CurrentCultureIgnoreCase));
        return new ItemFinderView(items, Save is IEventFlagArray);
    }

    /// <summary>Estado de los flags de evento pedidos (null si el juego no los expone).</summary>
    public bool[]? GetEventFlags(IReadOnlyList<int> ids)
    {
        if (Save is not IEventFlagArray flags)
            return null;
        var result = new bool[ids.Count];
        for (int i = 0; i < ids.Count; i++)
            result[i] = (uint)ids[i] < (uint)flags.EventFlagCount && flags.GetEventFlag(ids[i]);
        return result;
    }

    /// <summary>Objeto de MT/MO/DT → movimiento que enseña, con las tablas de PKHeX de cada juego.</summary>
    private Dictionary<int, int> Machines()
    {
        var map = new Dictionary<int, int>();
        void Zip(ReadOnlySpan<ushort> items, ReadOnlySpan<ushort> moves)
        {
            for (int i = 0; i < Math.Min(items.Length, moves.Length); i++)
            {
                if (items[i] != 0 && moves[i] != 0)
                    map.TryAdd(items[i], moves[i]);
            }
        }
        static ushort[] Concat(ReadOnlySpan<ushort> a, ReadOnlySpan<ushort> b) => [.. a, .. b];

        switch (Save)
        {
            case SAV1:
            {
                // Gen 1: MT01-MT50 son los objetos 201-250 y MO01-MO05 los 196-200.
                var items1 = new ushort[55];
                for (int i = 0; i < 50; i++)
                    items1[i] = (ushort)(201 + i);
                for (int i = 0; i < 5; i++)
                    items1[50 + i] = (ushort)(196 + i);
                var moves1 = new ushort[PersonalInfo1.MachineMoves.Length];
                for (int i = 0; i < moves1.Length; i++)
                    moves1[i] = PersonalInfo1.MachineMoves[i];
                Zip(items1, moves1);
                break;
            }
            case SAV2:
            {
                var moves2 = new ushort[PersonalInfo2.MachineMoves.Length];
                for (int i = 0; i < moves2.Length; i++)
                    moves2[i] = PersonalInfo2.MachineMoves[i];
                Zip(ItemStorage2.Machine, moves2);
            }
                break;
            case SAV3:
                Zip(ItemStorage3RS.Machine, Concat(PersonalInfo3.MachineMovesTechnical, PersonalInfo3.MachineMovesHidden));
                break;
            case SAV4HGSS:
                Zip(ItemStorage4.Machine, Concat(PersonalInfo4.MachineMovesTechnical, PersonalInfo4.MachineMovesHiddenHGSS));
                break;
            case SAV4:
                Zip(ItemStorage4.Machine, Concat(PersonalInfo4.MachineMovesTechnical, PersonalInfo4.MachineMovesHiddenDPPt));
                break;
            case SAV5:
                Zip(ItemStorage5.Machine, PersonalInfo5BW.MachineMoves);
                break;
            case SAV6XY:
                Zip(ItemStorage6XY.Machine, LearnSource6XY.MachineMoves);
                break;
            case SAV6AO:
                Zip(ItemStorage6AO.Machine, LearnSource6AO.MachineMoves);
                break;
            case SAV7b:
                Zip(ItemStorage7GG.Machine, LearnSource7GG.MachineMoves);
                break;
            case SAV7:
                Zip(ItemStorage7SM.Machine, PersonalInfo7.MachineMoves);
                break;
            case SAV8SWSH:
                // Movimientos: MT00-MT99 y DT00-DT99. Objetos: MT01-MT99 y DT00-DT99; la MT00 es el 1230.
                Zip(Concat([1230], ItemStorage8SWSH.MachineRecord), Concat(PersonalInfo8SWSH.MachineMovesTechnical, PersonalInfo8SWSH.MachineMovesRecord));
                break;
            case SAV8BS:
                Zip(ItemStorage8BDSP.Machine, PersonalInfo8BDSP.MachineMoves);
                break;
            case SAV9SV:
            {
                // La tabla de movimientos va por número de MT (la 0 no existe) y la de objetos
                // tiene huecos: se empareja por el número del nombre ("TM123").
                var en = GameInfo.GetStrings("en").GetItemStrings(EntityContext.Gen9, GameVersion.SL);
                var moves9 = PersonalInfo9SV.MachineMoves;
                foreach (var item in ItemStorage9SV.Machine)
                {
                    if (item < en.Length && en[item].StartsWith("TM") && int.TryParse(en[item][2..], out var n) && (uint)n < (uint)moves9.Length && moves9[n] != 0)
                        map.TryAdd(item, moves9[n]);
                }
            }
                break;
            case SAV9ZA:
                Zip(ItemStorage9ZA.TM, PersonalInfo9ZA.MachineMoves);
                break;
        }
        return map;
    }
}
