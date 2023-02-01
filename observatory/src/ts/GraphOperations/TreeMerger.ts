import { UniverseIndex } from '../SharedTypes/Indices'
import { Node } from './../UniverseTypes/Node'

export function mergeTrees(...trees: Node[]): Node {
    const mergedTree: Node = new Node('')
    trees.forEach((tree, i) => mergeNode(mergedTree, trees[i], i))
    return mergedTree
}

function mergeNode(mergedTree: Node, node: Node, treeIndex: UniverseIndex) {
    const matchingChild = mergedTree.children.find((mergedChild) => mergedChild.name === node.name)

    if (!matchingChild) {
        setOccurencesInRecursive(node, treeIndex)
        mergedTree.push(node)
    } else {
        matchingChild.occursIn.push(treeIndex)
        node.children.forEach((ownChild) => mergeNode(matchingChild, ownChild, treeIndex))
    }
}

function setOccurencesInRecursive(node: Node, value: UniverseIndex): void {
    node.occursIn = [value]
    node.children.forEach((child) => setOccurencesInRecursive(child, value))
}