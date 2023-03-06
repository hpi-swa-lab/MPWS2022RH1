import {ContainerSelections, CustomEventDetails, CustomEventName, Tree} from "../../SharedTypes/SankeyTree";
import {NodesFilter, NodesSortingFilter} from "../../SharedTypes/NodesFilter";
import {SortingOption, SortingOrder} from "../../enums/Sorting";

// #################################################################################################
// ##### (PRE-)PROCESSING UTILS ####################################################################
// #################################################################################################
export function createApplyFilterEvent(filter: NodesFilter) {
    return createCustomEventWithDetails(CustomEventName.APPLY_FILTER, filter)
}
//
// export function createExpandTreeEvent(filter: NodesFilter) {
//     return createCustomEventWithDetails(CustomEventName.EXPAND_TREE, filter)
// }
//
export function createCustomEventWithDetails(name: string, filter: NodesFilter) {
    return new CustomEvent<CustomEventDetails>(name, {
        detail: {
            name: name,
            filter: filter
        }
    })
}
//
// export function collapseChildren(d: any) {
//     if (!d.children) return
//
//     d.children.forEach((child: any) => collapseChildren(child))
//     d.children = null
// }
//
export function countPrivateLeaves(node: any): number {
    if (!node._children) {
        return 1
    }
    return node._children.reduce((sum: number, child: any) => sum + countPrivateLeaves(child), 0)
}

// #################################################################################################
// ##### EVENT UTILS ###############################################################################
// #################################################################################################

// // see source code: https://d3-graph-gallery.com/graph/interactivity_tooltip.html
// // Three function that change the tooltip when user hover / move / leave a cell
// export function mouseover(
//     event: MouseEvent,
//     d: HierarchyPointNode<Node>,
//     containerSelections: ContainerSelections
// ) {
//     containerSelections.tooltip.style('opacity', 1)
// }
//
// // FIXME fix it
// export function mousemove(
//     event: MouseEvent,
//     d: HierarchyPointNode<Node>,
//     containerSelections: ContainerSelections,
//     universePropsDict: UniverseMetadata
// ) {
//     const universesText = universePropsDict[Array.from(d.data.sources).join('')]
//         ? universePropsDict[Array.from(d.data.sources).join('')].name
//         : 'N/A'
//     containerSelections.tooltip
//         .html(
//             `**Node data:**
//                             <br>codeSize: ${d.data.codeSize}
//                             <br>isFiltered: ${d.data.isFiltered}
//                             <br>isModified: ${d.data.isModified}
//                             <br>universes: ${universesText}
//                             <br>has children: ${d.children?.length || undefined}
//                             <br>has _children: ${(d as any)._children?.length || undefined}
//                             `
//         )
//         .style('left', event.x + 20 + 'px')
//         .style('top', event.y + 'px')
// }
// export function mouseout(
//     event: MouseEvent,
//     d: HierarchyPointNode<Node>,
//     containerSelections: ContainerSelections
// ) {
//     containerSelections.tooltip.style('opacity', 0)
// }

// // Toggle children.
// export function toggle(d: any, doToggleBranch: boolean) {
//     if (!d._children) return
//
//     d.children
//         ? collapseChildren(d)
//         : (d.children = d._children.filter((child: any) => child.data.isFiltered))
//
//     if (doToggleBranch) {
//         for (const child of d.children) {
//             toggle(child, doToggleBranch)
//         }
//     }
// }

// export function handleCustomTreeEvent(event: any, tree: Tree) {
//     if (event.detail.name === CustomEventName.APPLY_FILTER) {
//         console.log(event.detail.name, true)
//         tree.root.eachBefore((node: any) => {
//             if (!node._children) return
//             sortChildren(node, event.detail.filter.sorting)
//             if (node.children) node.children = filterDiffingUniverses(node)
//         })
//     }
//
//     // expand full tree
//     if (event.detail.name === CustomEventName.EXPAND_TREE) {
//         console.log(event.detail.name, true)
//         tree.root.eachBefore((node: any) => {
//             if (!node._children) return
//             sortChildren(node, event.detail.filter.sorting)
//             node.children = filterDiffingUniverses(node)
//         })
//     }
// }
//
// function filterDiffingUniverses(node: any) {
//     if (!node._children) return
//     return node._children.filter((child: any) => child.data.isFiltered)
// }

// function sortChildren(node: any, filter: NodesSortingFilter) {
//     return node._children.sort((a: any, b: any) => {
//         const valueA = getSortingValue(a, filter)
//         const valueB = getSortingValue(b, filter)
//         if (filter.option !== SortingOption.NAME && valueA === valueB) {
//             // sort alphabetically ascending
//             // FIXME it's magically alphabetically reversed sometimes ò.ó
//             return a.name > b.name
//         }
//         return filter.order == SortingOrder.ASCENDING ? valueA > valueB : valueA < valueB
//     })
// }
//
// function getSortingValue(node: any, filter: NodesSortingFilter) {
//     switch (filter.option) {
//         case SortingOption.NAME:
//             return node.data.name
//         case SortingOption.SIZE:
//             return node.data.codeSize
//     }
// }

