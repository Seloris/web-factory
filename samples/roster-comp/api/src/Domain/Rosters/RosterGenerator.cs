using RosterComp.Domain.Catalogue;
using RosterComp.Domain.Players;

namespace RosterComp.Domain.Rosters;

/// <summary>
/// Places sheets on places: first the most places filled, then the most S choices, then A, then B, at random between
/// equal solutions. An exact assignment (Hungarian method) on sheets × places.
/// </summary>
public static class RosterGenerator
{
    // Every count is at most 20: in base 21, one more filled place outweighs any number of S, one S any number of A, and so on.
    private const long Base = 21;

    private const long FilledWeight = Base * Base * Base;

    // The noise stays below one rank step (Scale) even summed over 20 places: it only breaks ties.
    private const long Scale = 1000;

    private const int Noise = 50;

    public static IReadOnlyList<(Player Player, PlayerChoice Choice)> Assign(
        IReadOnlyList<Player> players, IReadOnlyList<Role> places, Random random)
    {
        var size = Math.Max(players.Count, places.Count);
        var weights = new long[size, size];
        var maxWeight = 0L;
        for (var i = 0; i < players.Count; i++)
        {
            for (var j = 0; j < places.Count; j++)
            {
                if (players[i].BestChoiceFor(places[j]) is { } choice)
                {
                    weights[i, j] = ((FilledWeight + RankWeight(choice.Rank)) * Scale) + random.Next(Noise);
                    maxWeight = Math.Max(maxWeight, weights[i, j]);
                }
            }
        }
        var costs = new long[size, size];
        for (var i = 0; i < size; i++)
        {
            for (var j = 0; j < size; j++)
            {
                costs[i, j] = maxWeight - weights[i, j];
            }
        }
        var columnOfRow = MinimumCostAssignment(costs);
        var result = new List<(Player, PlayerChoice)>();
        for (var i = 0; i < players.Count; i++)
        {
            var j = columnOfRow[i];
            if (j < places.Count && weights[i, j] > 0)
            {
                result.Add((players[i], players[i].BestChoiceFor(places[j])!));
            }
        }
        return result;
    }

    private static long RankWeight(Rank rank) => rank switch
    {
        Rank.S => Base * Base,
        Rank.A => Base,
        Rank.B => 1,
        _ => 0,
    };

    /// <summary>The Hungarian method with potentials on a square cost matrix: the column given to each row.</summary>
    private static int[] MinimumCostAssignment(long[,] cost)
    {
        var n = cost.GetLength(0);
        var u = new long[n + 1];
        var v = new long[n + 1];
        var rowOfColumn = new int[n + 1];
        var way = new int[n + 1];
        for (var i = 1; i <= n; i++)
        {
            rowOfColumn[0] = i;
            var j0 = 0;
            var minv = new long[n + 1];
            Array.Fill(minv, long.MaxValue);
            var used = new bool[n + 1];
            do
            {
                used[j0] = true;
                var i0 = rowOfColumn[j0];
                var delta = long.MaxValue;
                var j1 = 0;
                for (var j = 1; j <= n; j++)
                {
                    if (used[j])
                    {
                        continue;
                    }
                    var current = cost[i0 - 1, j - 1] - u[i0] - v[j];
                    if (current < minv[j])
                    {
                        minv[j] = current;
                        way[j] = j0;
                    }
                    if (minv[j] < delta)
                    {
                        delta = minv[j];
                        j1 = j;
                    }
                }
                for (var j = 0; j <= n; j++)
                {
                    if (used[j])
                    {
                        u[rowOfColumn[j]] += delta;
                        v[j] -= delta;
                    }
                    else
                    {
                        minv[j] -= delta;
                    }
                }
                j0 = j1;
            }
            while (rowOfColumn[j0] != 0);
            do
            {
                var j1 = way[j0];
                rowOfColumn[j0] = rowOfColumn[j1];
                j0 = j1;
            }
            while (j0 != 0);
        }
        var columnOfRow = new int[n];
        for (var j = 1; j <= n; j++)
        {
            columnOfRow[rowOfColumn[j] - 1] = j - 1;
        }
        return columnOfRow;
    }
}
