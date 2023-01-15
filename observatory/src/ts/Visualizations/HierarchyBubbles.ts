import * as d3 from 'd3'
import Visualization from './Visualization'
import CircleNode from '../SharedInterfaces/CircleNode'
import Edge from '../SharedInterfaces/Edge'
import { uniqueColor, deepCopy } from '../utils'
import Tooltip from '../Components/Tooltip'
import { forceCollide, forceLink, forceSimulation } from 'd3'
import HierarchyNodeWithSize from '../SharedInterfaces/HierarchyNodeWithSize'
import { NodeType } from '../SharedInterfaces/Node'

export default class HierarchyBubbles implements Visualization {
    container: HTMLElement | null

    hierarchy: HierarchyNodeWithSize
    hierarchyById: Record<number, HierarchyNodeWithSize>

    nodes: CircleNode[] = []
    nodesById: Record<number, CircleNode> = {}
    edges: Edge[] = []

    tooltip: Tooltip = new Tooltip()

    simulation: d3.Simulation<CircleNode, undefined> = forceSimulation<CircleNode>([])

    constructor(hierarchy: HierarchyNodeWithSize) {
        this.container = document.getElementById('hierarchy-bubbles-container')

        this.hierarchy = hierarchy
        this.hierarchyById = {}
        this._getNodes(this.hierarchy).forEach((node) => {
            this.hierarchyById[node.id] = node
        })
    }

    generate(): void {
        if (!this.container) return

        this.container.appendChild(this.tooltip.widget)
        ;[this.nodes, this.nodesById] = this._constructNodes(this.hierarchy)
        this.edges = this._constructEdges(this.hierarchy)

        this._prepareSVG()

        this.simulation = forceSimulation<CircleNode>(this.nodes)
            .force('link', forceLink(this.edges))
            .force(
                'collision',
                forceCollide<CircleNode>().radius((node: CircleNode) => node.radius * 1.1)
            )
            .on('tick', () => this._tick())

        this.simulation.stop()
    }

    continueSimulation(callback: () => void = () => {}, milliseconds: number = 5000) {
        this.simulation.restart()
        setTimeout(() => {
            this.simulation.stop()
            callback()
        }, milliseconds)
    }

    _constructNodes(
        startingPoint: HierarchyNodeWithSize
    ): [CircleNode[], Record<number, CircleNode>] {
        const result: CircleNode[] = []
        const resultIdMapping: Record<number, CircleNode> = {}

        const nodes = this._getNodes(startingPoint, true)
        const colorMapping: Record<string, string> = {}

        const columns = Math.floor(Math.sqrt(nodes.length))
        const padding = 5
        const minNodeSize = 5

        nodes.forEach((node: HierarchyNodeWithSize, index: number) => {
            const colorIdentifyer: string = this._getColorIdentifyerForNode(node)

            let color: string
            if (colorMapping[colorIdentifyer]) {
                color = colorMapping[colorIdentifyer]
            } else {
                color = uniqueColor(Object.values(colorMapping))
                colorMapping[colorIdentifyer] = color
            }

            const radius = node.children
                .filter((child: HierarchyNodeWithSize) => child.type !== NodeType.Package)
                .map((child: HierarchyNodeWithSize) => child.accumulatedCodeSize)
                .reduce((sum: number, current: number) => sum + current, minNodeSize)

            const newNode: CircleNode = {
                x:
                    Math.floor(index % columns) * padding * 2 +
                    (Math.floor(index % columns) - 1) * padding,
                y:
                    Math.floor(index / columns) * padding * 2 +
                    (Math.floor(index / columns) - 1) * padding,
                color: color,
                label: node.name,
                radius: radius,
                tooltip: node.fullPath,
                referenceToData: node.id
            }

            resultIdMapping[node.id] = newNode
            result.push(newNode)
        })

        return [result, resultIdMapping]
    }

    _constructEdges(startingPoint: HierarchyNodeWithSize): Edge[] {
        let result: Edge[] = []

        startingPoint.children.forEach((child: HierarchyNodeWithSize) => {
            if (startingPoint !== this.hierarchy) {
                const source = this.nodes.indexOf(this.nodesById[startingPoint.id])
                const target = this.nodes.indexOf(this.nodesById[child.id])

                if (source !== -1 && target !== -1) {
                    result.push({
                        source: source,
                        target: target,
                        weight: 1
                    })
                }
                
            }

            result = result.concat(this._constructEdges(child))
        })

        debugger

        return result
    }

    _getColorIdentifyerForNode(node: HierarchyNodeWithSize): string {
        if (node.parent === null) {
            return ''
        }
        return node.parent.fullPath
    }

    _getNodes(startingPoint: HierarchyNodeWithSize, onlyPackages = false): HierarchyNodeWithSize[] {
        let result: HierarchyNodeWithSize[] = []

        if (onlyPackages) {
            if (startingPoint !== this.hierarchy && startingPoint.type === NodeType.Package) {
                result.push(startingPoint)
            }
        } else {
            if (startingPoint !== this.hierarchy) {
                result.push(startingPoint)
            }
        }

        if (startingPoint.children.length > 0) {
            startingPoint.children.forEach((child) => {
                result = result.concat(this._getNodes(child, onlyPackages))
            })
        }

        return result
    }

    _prepareSVG(): void {
        let svg = d3
            .select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .call(
                d3.zoom<SVGSVGElement, unknown>().on('zoom', function (event) {
                    svg.attr('transform', event.transform)
                })
            )
            .append('g')
    }

    _tick(): void {
        d3.select('svg g')
            .selectAll('circle')
            .data(this.nodes)
            .join('circle')
            .attr('r', (node: CircleNode) => node.radius)
            .style('fill', (node: CircleNode) => node.color)
            .attr('cx', (node: CircleNode) => node.x)
            .attr('cy', (node: CircleNode) => node.y)
            .on('mouseover', (event, node: CircleNode) => {
                d3.selectAll('circle')
                    .data(this.nodes)
                    .join('circle')
                    .transition()
                    .duration(100)
                    .style('fill', (otherNode: CircleNode) => {
                        if (otherNode.color === node.color) {
                            return otherNode.color
                        } else {
                            return otherNode.color + '22'
                        }
                    })

                if (node.referenceToData) {
                    const dataNode = this.hierarchyById[node.referenceToData]

                    this.tooltip.title = node.label
                    this.tooltip.datapoints = {
                        label: dataNode.name,
                        'full path': dataNode.fullPath,
                        size: dataNode.accumulatedCodeSize,
                        'sub tree size': dataNode.subTreeSize,
                        type: dataNode.type
                    }
                    this.tooltip.setVisible()
                }
            })
            .on('mousemove', (event) => {
                this.tooltip.moveToCoordinates(event.pageY - 10, event.pageX + 10)
            })
            .on('mouseout', (event, node: CircleNode) => {
                d3.selectAll('circle')
                    .data(this.nodes)
                    .join('circle')
                    .transition()
                    .duration(100)
                    .style('fill', (otherNode: CircleNode) => otherNode.color)

                this.tooltip.setInvisible()
            })

        d3.select('svg g')
            .selectAll('text')
            .data(this.nodes)
            .join('text')
            .text((node: CircleNode) => node.label)
            .attr('font-size', (node: CircleNode) => node.radius / 2 + 'px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'central')
            .attr('x', (node: CircleNode) => node.x)
            .attr('y', (node: CircleNode) => node.y)
    }
}
