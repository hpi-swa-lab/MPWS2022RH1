import {
    CausalityGraphUniverse,
    collectCgNodesInSubtree,
    forEachInSubtree,
    FullyHierarchicalNode
} from '../UniverseTypes/CausalityGraphUniverse'
import { CutView } from './CutTool/CutView'
import { ImageView } from './CutTool/ImageView'
import { DetailView } from './CutTool/DetailView'
import { PurgeResults, ReachabilityVector } from './CutTool/BatchPurgeScheduler'
import { PurgeScheduler } from './CutTool/PurgeScheduler'
import { AsyncCausalityGraph } from '../Causality/AsyncCausalityGraph'
import { assert } from '../util/assert'
import { UniverseVisualization } from './UniverseVisualization'
import { Universe } from '../UniverseTypes/Universe'
import { ColorScheme } from '../SharedTypes/Colors'
import { Filter } from '../SharedTypes/Filters'

class CutTool {
    readonly domRoot: HTMLDivElement
    readonly ps: PurgeScheduler
    readonly cg: AsyncCausalityGraph
    readonly cutview: CutView
    readonly imageview: ImageView
    readonly detailview: DetailView

    readonly dataRoot: FullyHierarchicalNode

    readonly allReachable: ReachabilityVector
    readonly codesizes: number[]

    readonly singleSimulationResultCache = new Map<FullyHierarchicalNode, ReachabilityVector>()
    additionalSimulationResults:
        | undefined
        | {
              cache: Map<FullyHierarchicalNode, ReachabilityVector>
              onlySelected: ReachabilityVector
          }

    constructor(
        domRoot: HTMLDivElement,
        universe: CausalityGraphUniverse,
        cg: AsyncCausalityGraph,
        allReachable: ReachabilityVector
    ) {
        this.domRoot = domRoot
        this.dataRoot = universe.causalityRoot
        this.cg = cg
        this.allReachable = allReachable
        this.codesizes = universe.codesizeByNodeLabels

        this.ps = new PurgeScheduler(cg, allReachable.results)
        this.ps.detailSelectedCallback = (edges, targetMid) =>
            this.detailview.renderGraphOnDetailView(edges, targetMid)

        this.ps.singlePurgeCallback = (v, data) => {
            if (!v) return
            const dataAndSize = new ReachabilityVector(data, this.codesizes)
            this.singleSimulationResultCache.set(v, dataAndSize)
            this.cutview.setSinglePurgeData(v, dataAndSize.size - this.allReachable.size)
        }
        this.ps.additionalPurgeCallback = (v, data) => {
            const dataAndSize = new ReachabilityVector(data, this.codesizes)

            if (v === undefined) {
                assert(this.additionalSimulationResults === undefined)
                this.additionalSimulationResults = {
                    cache: new Map<FullyHierarchicalNode, ReachabilityVector>(),
                    onlySelected: dataAndSize
                }
            } else {
                assert(this.additionalSimulationResults !== undefined)
                this.additionalSimulationResults.cache.set(v, dataAndSize)
                this.cutview.setAdditionalPurgeData(
                    v,
                    dataAndSize.size - this.additionalSimulationResults.onlySelected.size
                )
            }
        }

        this.cutview = new CutView(
            (v) => this.cutView_onExpanded(v),
            (v) => this.cutView_onSelectionChanged(v),
            (v) => this.cutView_onHover(v)
        )

        this.cutview.populate(domRoot.querySelector('#cut-overview-root')!, universe.causalityRoot)

        this.imageview = new ImageView(
            allReachable.results,
            universe.causalityRoot,
            universe.codesizeByNodeLabels,
            Math.max(...this.dataRoot.children.map((d) => d.accumulatedSize)),
            (v) => (this.ps.detailSelectedNode = v)
        )

        this.imageview.populate(domRoot.querySelector('#imageview-root')!)

        this.detailview = new DetailView(
            domRoot.querySelector('#detail-div')!,
            universe.nodeLabels,
            universe.typeLabels
        )

        let mainMethod: FullyHierarchicalNode | undefined
        forEachInSubtree(this.dataRoot, (v) => {
            if (v.main) mainMethod = v
        })
        if (mainMethod) this.cutview.expandTo(mainMethod)

        this.ps.paused = false
    }

    public static async create(domRoot: HTMLDivElement, universe: CausalityGraphUniverse) {
        domRoot.querySelector<HTMLDivElement>('#main-panel')!.hidden = true
        domRoot.querySelector<HTMLDivElement>('#loading-panel')!.hidden = false
        const cg = await universe.getCausalityGraph()
        const allReachable = new ReachabilityVector(
            new PurgeResults(await cg.simulatePurge()),
            universe.codesizeByNodeLabels
        )
        domRoot.querySelector<HTMLDivElement>('#loading-panel')!.hidden = true
        domRoot.querySelector<HTMLDivElement>('#main-panel')!.hidden = false
        return new CutTool(domRoot, universe, cg, allReachable)
    }

    public dispose() {
        this.domRoot.querySelector('#imageview-root')!.textContent = ''
        this.domRoot.querySelector('#cut-overview-root')!.textContent = ''
        this.domRoot.querySelector<HTMLDivElement>('#main-panel')!.hidden = true
        this.detailview.dispose()
        this.ps.paused = true // Don't do any more work in the background!
    }

    closeDetailView(): void {
        this.imageview.clearDetailSelection()
    }

    private cutView_onExpanded(v: FullyHierarchicalNode) {
        for (const w of v.children) {
            const cachedResult = this.singleSimulationResultCache.get(w)
            if (cachedResult)
                this.cutview.setSinglePurgeData(w, cachedResult.size - this.allReachable.size)
        }
        this.ps.requestSinglePurgeInfo(
            v.children.filter((w) => !this.singleSimulationResultCache.has(w))
        )

        if (this.cutview.selectedForPurging.size > 0) {
            let containedInSelection = false
            for (const u of [...this.cutview.selectedForPurging]) {
                forEachInSubtree(u, (w) => {
                    if (w === v) containedInSelection = true
                })
            }

            if (!containedInSelection) {
                if (this.additionalSimulationResults === undefined) {
                    this.ps.requestAdditionalPurgeInfo(v.children)
                } else {
                    for (const w of v.children) {
                        const cachedResult = this.additionalSimulationResults.cache.get(w)
                        if (cachedResult) {
                            this.cutview.setAdditionalPurgeData(
                                w,
                                cachedResult.size -
                                    this.additionalSimulationResults.onlySelected.size
                            )
                        }
                    }
                    this.ps.requestAdditionalPurgeInfo(
                        v.children.filter((w) => !this.additionalSimulationResults!.cache.has(w))
                    )
                }
            }
        }
    }

    private async cutView_onSelectionChanged(v: FullyHierarchicalNode | undefined) {
        this.ps.purgeSelectedNodes = [...this.cutview.selectedForPurging]

        let stillReachable: PurgeResults | undefined

        if (v !== undefined) {
            const cache =
                this.cutview.selectedForPurging.size === 1
                    ? this.singleSimulationResultCache
                    : this.additionalSimulationResults?.cache
            const data = cache?.get(v)
            if (data) stillReachable = data.results
        } else if (this.cutview.selectedForPurging.size === 0) {
            stillReachable = this.allReachable.results
        }

        if (!stillReachable) {
            // We have to simulate
            const purgeSet = [
                ...new Set([...this.cutview.selectedForPurging].flatMap(collectCgNodesInSubtree))
            ]
            stillReachable = new PurgeResults(await this.cg.simulatePurge(purgeSet))
        }

        this.additionalSimulationResults = undefined
        for (const v of this.cutview.visibleNodes) this.cutview.setAdditionalPurgeData(v, undefined)

        if (this.cutview.selectedForPurging.size > 0)
            this.ps.requestAdditionalPurgeInfo(Array.from(this.cutview.visibleNodes))

        this.imageview.updateReachableSets(stillReachable, stillReachable)
    }

    // Returns whether the hovering effect should be shown
    private cutView_onHover(v: FullyHierarchicalNode | undefined): boolean {
        let reachableOnHover: PurgeResults | undefined | null
        if (v) {
            const cache =
                this.cutview.selectedForPurging.size === 0
                    ? this.singleSimulationResultCache
                    : this.additionalSimulationResults?.cache
            reachableOnHover = cache?.get(v)?.results
        } else {
            reachableOnHover = null // Explicit command to reset the hover set
        }

        if (reachableOnHover !== undefined)
            this.imageview.updateReachableSets(undefined, reachableOnHover)
        return reachableOnHover !== undefined
    }
}

// Wrapper around the mostly immutable CutTool
export class CutToolVis implements UniverseVisualization {
    colorScheme: ColorScheme = []
    highlights = new Set<string>()
    selection = new Set<string>()

    filters: Filter[] = [] // TODO: https://github.com/hpi-swa-lab/MPWS2022RH1/issues/156

    private universeSpecificCutTool: Promise<CutTool | undefined> | undefined
    private readonly domRoot: HTMLDivElement

    constructor(domRoot: HTMLDivElement) {
        this.domRoot = domRoot
    }

    setUniverse(universe: Universe): void {
        this.onUniverseChanged(universe instanceof CausalityGraphUniverse ? universe : undefined)
    }

    setHighlights(_: Set<string>): void {
        // TODO: https://github.com/hpi-swa-lab/MPWS2022RH1/issues/156
    }

    setSelection(_: Set<string>): void {
        // TODO: https://github.com/hpi-swa-lab/MPWS2022RH1/issues/156
    }

    setFilters(filters: Filter[]): void {
        // TODO: https://github.com/hpi-swa-lab/MPWS2022RH1/issues/156
    }

    async closeDetailView() {
        ;(await this.universeSpecificCutTool)?.closeDetailView()
    }

    private async destroyAndCreate(universe: CausalityGraphUniverse | undefined) {
        // Ensures sequential execution by waiting on the previous destroyAndCreate(...)
        const oldVis = await this.universeSpecificCutTool
        oldVis?.dispose()
        return universe ? await CutTool.create(this.domRoot, universe) : undefined
    }

    private onUniverseChanged(universe: CausalityGraphUniverse | undefined) {
        this.universeSpecificCutTool = this.destroyAndCreate(universe)
    }
}
