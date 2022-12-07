import HierarchyBubbles from './Visualizations/HierarchyBubbles'
import VennVisualization from './Visualizations/VennVisualization'
import TreeVisualization from './Visualizations/TreeVisualization'
import ZoomableCausalityGraph from './Visualizations/ZoomableCausalityGraph'
import { loadTextFile, loadCSVFile } from './BuildReportsParser'
import { parseToCleanedPackageHierarchy } from './BuildReportsParser'

export async function generateHierarchyBubbles(file: File): Promise<HierarchyBubbles> {
    const inputString = await loadTextFile(file)
    const hierarchy = parseToCleanedPackageHierarchy(inputString)

    const visualization = new HierarchyBubbles(hierarchy)
    visualization.generate()

    return visualization
}

export async function generateZoomableausalityGraph(
    entryPointsFile: File,
    methodsFile: File,
    directEdgesFile: File,
    virtualEdgesFile: File,
): Promise<ZoomableCausalityGraph> {
    const [entryPoints, methods, directEdges, virtualEdges] = await Promise.all([
        loadCSVFile(entryPointsFile),
        loadCSVFile(methodsFile),
        loadCSVFile(directEdgesFile),
        loadCSVFile(virtualEdgesFile)
    ])

    debugger

    // TODO: csv in sinnvolle Daten parsen.

    return new ZoomableCausalityGraph()
}

export function generateVenn() {
    let venn = new VennVisualization()
    venn.generate()
}

export function generateTree() {
    let tree = new TreeVisualization()
    tree.generate()
}
