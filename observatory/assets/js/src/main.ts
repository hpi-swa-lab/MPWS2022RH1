import HierarchyBubbles from './Visualizations/HierarchyBubbles'
import VennVisualization from './Visualizations/VennVisualization'
import SankeyTreeVisualization from './Visualizations/tree/SankeyTreeVisualization'
import BubbleTreeVisualization from './Visualizations/tree/BubbleTreeVisualization'
import {
    loadBuildReport,
    loadTextFile,
    parseBuildReportToNodeWithSizeHierarchy
} from './BuildReportsParser'
import * as d3 from 'd3'

export async function generateHierarchyBubbles(file: File): Promise<HierarchyBubbles> {
    const reportData = await loadBuildReport(file)
    const hierarchy = parseBuildReportToNodeWithSizeHierarchy(reportData, true)

    const visualization = new HierarchyBubbles(hierarchy)
    visualization.generate()

    return visualization
}

export function generateVenn() {
    let venn = new VennVisualization()
    venn.generate()
}

export async function generateBubbleTree(fileList: FileList) {
    let texts: string[]
    let universeNames: string[]
    if (fileList.length < 2) {
        // TODO remove later when not needed
        const filePaths = [
            '../assets/data/used_methods_micronautguide.txt',
            '../assets/data/used_methods_helloworld.txt'
        ]

        texts = await Promise.all(filePaths.map((file) => d3.text(file)))
        universeNames = filePaths.map((path) => {
            const pathSegments = path.split('/')
            const nameSegments = pathSegments[pathSegments.length - 1].split('_')
            return nameSegments[nameSegments.length - 1].split('.')[0]
        })
    } else {
        const files = Array.from(fileList)
        texts = await Promise.all(files.map((file) => loadTextFile(file)))
        universeNames = files.map((file) => {
            const nameSegments = file.name.split('_')
            return nameSegments[nameSegments.length - 1].split('.')[0]
        })
    }

    let tree = new BubbleTreeVisualization(texts, universeNames)
    tree.generate()
}

export async function generateSankeyTree(fileList: FileList) {
    let texts: string[]
    let universeNames: string[]
    if (fileList.length < 2) {
        // TODO remove later when not needed
        const filePaths = [
            '../assets/data/used_methods_micronautguide.txt',
            '../assets/data/used_methods_helloworld.txt'
        ]

        texts = await Promise.all(filePaths.map((file) => d3.text(file)))
        universeNames = filePaths.map((path) => {
            const pathSegments = path.split('/')
            const nameSegments = pathSegments[pathSegments.length - 1].split('_')
            return nameSegments[nameSegments.length - 1].split('.')[0]
        })
    } else {
        const files = Array.from(fileList)
        texts = await Promise.all(files.map((file) => loadTextFile(file)))
        universeNames = files.map((file) => {
            const nameSegments = file.name.split('_')
            return nameSegments[nameSegments.length - 1].split('.')[0]
        })
    }

    let sankeyTree = new SankeyTreeVisualization(texts, universeNames)
    sankeyTree.generate()
}

export async function testBuildReportParser(file: File) {
    const reportData = await loadBuildReport(file)
    console.log('Report data: ', reportData)

    const parsedHierarchy = parseBuildReportToNodeWithSizeHierarchy(reportData)
    console.log('Parsed hierarchy: ', parsedHierarchy)
}
