import { Node } from './../UniverseTypes/Node'

export interface VennPartitions {
    inclusive: VennSet[]
    exclusive: VennSet[]
}

export interface VennSet {
    sets: string[]
    size: number
}

export function toVennPartitions(mergedTree: Node): VennPartitions {
    const powerSetCache = new Map<string, string[]>()
    const inclusiveCounts = new Map<string, number>()
    const exclusiveCounts = new Map<string, number>()
    mergedTree.children.forEach(countIn)

    function countIn(node: Node): void {
        const occurences = Array.from(node.occursIn.keys())
        const intersection = JSON.stringify(occurences)
        exclusiveCounts.set(intersection, (exclusiveCounts.get(intersection) ?? 0) + 1)

        const combinations = hitOrCalculateOnMiss(occurences, intersection, powerSetCache)
        combinations.forEach((combination) =>
            inclusiveCounts.set(combination, (inclusiveCounts.get(combination) ?? 0) + 1)
        )

        node.children.forEach(countIn)
    }

    return {
        inclusive: toVennSets(inclusiveCounts),
        exclusive: toVennSets(exclusiveCounts)
    }
}

// From https://codereview.stackexchange.com/questions/139095/generate-powerset-in-js
export function powerSet(l: unknown[]): unknown[][] {
    return (function ps(list): unknown[][] {
        if (list.length === 0) {
            return [[]]
        }
        const head: unknown = list.pop()
        const tailPS: unknown[][] = ps(list)
        return tailPS.concat(tailPS.map((e: unknown[]) => [...e, head]))
    })(l.slice())
}

function hitOrCalculateOnMiss(combinees: number[], key: string, cache: Map<string, string[]>) {
    const subCombinations =
        cache.get(key) ??
        powerSet(combinees)
            .slice(1) // Ignore the empty power set
            .map((combination) => JSON.stringify(combination))

    if (!cache.has(key)) {
        cache.set(key, subCombinations)
    }

    return subCombinations
}

function toVennSets(counts: Map<string, number>): VennSet[] {
    return Array.from(counts, ([combination, count]) => {
        return { sets: JSON.parse(combination), size: count }
    }).sort((a, b) => a.sets.length - b.sets.length)
}
