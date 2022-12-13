import * as d3 from 'd3'
import {HierarchyPointNode} from "d3";
import TreeVisualization from "./TreeVisualization";
import {
    countPrivateLeaves,
    createHierarchyFromPackages, Dictionary, margin, markTreeUnmodified,
    markNodesModifiedFromLeaves,
    MyNode,
    SvgSelections, Tree, TreeNodesFilter, UniverseProps, updateTree
} from "./SvgTreeUtils";

export default class TreeVisualizationSVG extends TreeVisualization {

    universesMetadata: Dictionary<UniverseProps>;
    filter: TreeNodesFilter;

    constructor() {
        super()

        // this.universesMetadata = {}
        this.universesMetadata = {
            '0': {name: 'micronautguide', color: d3.rgb(200,0,0)},
            '1': {name: 'helloworld', color: d3.rgb(0,200,0)},
            '01': {name: 'micronautguide, helloworld', color: d3.rgb(150,150, 150)},
            'modified': {name: 'modified but common', color: d3.rgb(0,0, 200)}
        }
        this.filter = {
            // universes: new Set(Object.keys(this.universesMetadata).filter(key => key.length == 1))
            universes: new Set('1')
        }
    }

    generate(): void {

        this.loadUniverses().then((tree:Tree) => {
            console.debug("Universes: ", tree)

            const form = this.createInputForm()

            const svg = d3.select('body').append('svg');

            // TODO remove pattern if unused
            // svg.append('pattern')
            //     .attr('id', 'diagonalHatch')
            //     .attr('patternUnits', 'userSpaceOnUse')
            //     .attr('width', 8)
            //     .attr('height', 8)
            // .append('path')
            //     .attr('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
            //     .attr('stroke', '#ff0000')
            //     .attr('stroke-width', 4)
            // .append('path')
            //     .attr('d', '2,-2 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
            //     .attr('stroke', '#00ff00')
            //     .attr('stroke-width', 1)

            const width = document.body.clientWidth;
            const height = document.body.clientHeight;
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            const defaultViewbox = [
                0,
                0,
                innerWidth,
                innerHeight
            ].join(" ");

            tree.root.descendants().forEach((d: any, i) => {
                d.id = i;
                d._children = d.children;
                // if (d.depth > 0) d.children = null; // only expand the first level of children
            });

            const dx = 20;
            const dy = innerWidth / 6;

            tree.layout = d3.tree()
                .nodeSize([dx, dy])
                .separation(function (a, b) {
                    let totalWidth = countPrivateLeaves(a) / 2 + countPrivateLeaves(b) / 2;
                    return (totalWidth / dx) + 1;
                })

            const zoomG = svg
                .attr('width', innerWidth)
                .attr('height', innerHeight)
                .attr('viewBox', defaultViewbox)
                .append('g')
                .attr('id', 'zoomG')
                .attr("width", innerWidth - margin.left)
                .attr("height", innerHeight * 0.5)
                .attr('transform', `translate(${margin.left}, ${innerHeight * 0.5})`)

            // TODO clean up, the rect is only for test reasons
            // zoomG.append("rect")
            //     .attr("width", "100%")
            //     .attr("height", innerHeight * 0.5)
            //     .attr("fill", "orange");

            // console.debug(svg.node(), '\n', zoomG.node())

            const svgSelections: SvgSelections = {
                svg: svg,
                zoomG: zoomG,
                gLink: zoomG.append("g")
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-opacity", 0.4)
                    .attr("stroke-width", 1.5),
                gNode: zoomG.append("g")
                    .attr("cursor", "pointer")
                    .attr("pointer-events", "all"),
                tooltip: d3.select('body')
                    .append("div")
                    .style("opacity", 0)
                    .attr("class", "tooltip")
                    .style("background-color", "white")
                    .style("border", "solid")
                    .style("border-width", "2px")
                    .style("border-radius", "5px")
                    .style("padding", "5px")
                    .style('position', 'absolute')
            }

            svg.call(d3.zoom().on('zoom', (svgTransform) => {
                zoomG.attr('transform', svgTransform.transform)
                updateTree(null, tree.root, this.filter, tree, svgSelections, this.universesMetadata)
            }));

            form.addEventListener('submit', (e) => this.submit(e, tree, svgSelections, this.universesMetadata))

            updateTree(null, tree.root, this.filter, tree, svgSelections, this.universesMetadata);
        });


    }


    // ##################################################################
    // ### BUILD TREE HELPER FUNCTIONS #############################################
    // ##################################################################

    async loadUniverses() {
        // must be in the same order as read-in files!
        const universeNames = ['micronautguide', 'helloworld']
        const texts = await Promise.all([
            d3.text('../assets/data/used_methods_micronautguide.txt'),
            d3.text('../assets/data/used_methods_helloworld.txt')
        ]);

        // build tree including universes
        let treeData: MyNode = {name: 'diffing', children: [], parent: undefined, universes: new Set<number>(), isModified: false};
        let sets = new Set<string>()
        let leaves: Set<MyNode> = new Set()

        texts.forEach((text,i) => {
            createHierarchyFromPackages(i, text, treeData, leaves, sets)
        })

        const tree: Tree = {
            root: d3.hierarchy(treeData) as HierarchyPointNode<MyNode>,
            leaves: Array.from(leaves),
            sets: Array.from(sets),
            treeData: treeData
        }

        markNodesModifiedFromLeaves(tree.leaves, this.filter)


        // let colors:d3.RGBColor[] = [d3.rgb(200,0,0), d3.rgb(0,200,0), d3.rgb(150,150,150)]
        //
        // myTree.sets.forEach((setId, i) => {
        //     that.universesMetadata[setId] = {
        //         name: setId.split('').map((id:string) => universeNames[parseInt(id)]).join(', '),
        //         color: colors[i]
        //     }
        // })
        //
        // that.universesMetadata['modified'] = {
        //     name: 'common but modified',
        //     color: d3.rgb(0,0,200)
        // }

        console.debug('universesMetadata: ', this.universesMetadata)
        for (let key in this.universesMetadata) {
            console.debug(`%c ${key}, ${this.universesMetadata[key].name}`, `background: ${this.universesMetadata[key].color}`)
        }

        // Filter out basic packages used in both universes
        // dataTree.children.filter((child:MyNode) => child.universes.size < 2)
        return  tree
    }

    createInputForm() {
        const form = document.createElement('form')
        const fieldset = document.createElement('fieldset')
        const legend = document.createElement('legend')
        legend.innerText = 'Choose Universe(s) to be displayed'
        fieldset.appendChild(legend)

        const keys = Object.keys(this.universesMetadata)
        keys.pop() // removes the modified but common option
        const filteredKeys = keys.filter(key => key.length == 1)
       filteredKeys.forEach(key => {
           const div = document.createElement('div')
           const checkbox = document.createElement('input')
           checkbox.setAttribute('type', 'checkbox')
           checkbox.setAttribute('id', key)
           checkbox.setAttribute('value', key)

           if(this.filter.universes.has(key))
               checkbox.checked = true;

           const label = document.createElement('Label')
           label.setAttribute('for', key)
           label.innerText = this.universesMetadata[key].name

           div.appendChild(checkbox)
           div.appendChild(label)
           fieldset.appendChild(div)
        })
        form.appendChild(fieldset)

        const submitBtn = document.createElement('button')
        submitBtn.setAttribute('type', 'submit')
        submitBtn.innerText = 'update tree'
        fieldset.appendChild(submitBtn)
        document.body.appendChild(form)

        return form
    }

    submit(e:SubmitEvent, tree: Tree, svgSelections: SvgSelections, universePropsDict: Dictionary<UniverseProps>) {
        e.preventDefault(); // prevent page refresh

        const form = e.target as HTMLFormElement
        const checkedKeys = Array.from(form.querySelectorAll("input[type=checkbox]:checked")).map((item:HTMLInputElement) => item.value)
        console.log(`%c form submitted [${checkedKeys}]`, 'background: green')


        this.filter.universes = new Set(checkedKeys)

        markTreeUnmodified(tree.treeData)
        markNodesModifiedFromLeaves(tree.leaves, this.filter)

        updateTree(null, tree.root, this.filter, tree, svgSelections, universePropsDict)
    }

}
