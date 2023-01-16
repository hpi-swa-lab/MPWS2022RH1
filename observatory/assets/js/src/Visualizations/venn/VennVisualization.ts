import Visualization from '../Visualization'
import * as d3 from 'd3'
import * as venn from 'venn.js'
import {get_universe_intersections, intersections_between, universe_to_venn_set, sameMembers,  SEPARATOR} from "./data_formatter";
import {FILE_NAME_1, FILE_NAME_2} from "../../main";

export default class VennVisualization implements Visualization {
    constructor() {}

    generate(): void {
        Promise.all([
            d3.csv(`../assets/data/venn/used_packages_${FILE_NAME_1}.csv`),
            d3.csv(`../assets/data/venn/used_packages_${FILE_NAME_2}.csv`),
            // d3.csv("../assets/data/venn/HW.csv"),
            // d3.csv("../assets/data/venn/MB.csv"),
            // d3.csv("../assets/data/venn/MB4j.csv"),
        ]).then(function(files) {
            // Files to universes
            const names = [FILE_NAME_1, FILE_NAME_2];
            // const names = ['Hello World', 'Micronaut Basic', 'Micronaut w/ log4j'];
            const universes = files.map((file, index) =>
                Object.create({}, {
                    name: {value: names[index]},
                    packages: {value: file}
                }));

            // Universes to intersections & venn sets
            const exclusive_intersections = get_universe_intersections(universes);
            const inclusive_intersections = intersections_between(universes);
            const venn_sets = inclusive_intersections.map(universe_to_venn_set);

            // Visualize Data
            const tooltipOffSet = 30;
            const fociOffset = [10, 40];
            const transitionDuration = 400;
            const innerCircleRadius = 5;
            const bubble_svg_width = 1600;
            const bubble_svg_height = 800;
            const colors = ["#4e79a7","#e15759","#76b7b2","#59a14f","#edc949","#f28e2c", "#af7aa1","#ff9da7","#9c755f","#bab0ab"]; //tableau 10
            const num_packages = exclusive_intersections
                .map(i => i.packages.length)
                .reduce((a, b) => a+b);

            const svgContainer = d3.select("#svg")
                .append("svg")
                .attr("width", bubble_svg_width)
                .attr("height", bubble_svg_height);
            const venngroup = svgContainer.append("g").attr("id", "venngroup");
            const chart = venn.VennDiagram({
                colorScheme: colors,
                textFill: '#000',
            }).width(bubble_svg_width).height(bubble_svg_height);
            const div = d3.select("#venngroup");
            div.datum(venn_sets).call(chart);

            // Aesthetics
            div.selectAll(".venn-circle path")
                .style("display", "none");

            // tooltip
            const tooltip = d3.select("#tooltip");

            // force layout
            const foci = div.selectAll("g.venn-area text.label").nodes().map((node:any) => Object.create({}, {
                x: {value: node.attributes.x.value },
                y: {value: node.attributes.y.value },
            }));
            var nodes: any[] = [];
            exclusive_intersections.forEach((universe, index) => {
                nodes.push(...universe.packages.map((pkg:any) => Object.create({}, {
                    universe: {value: exclusiveIndexToInclusive(index)},
                    name: {value: pkg.name},
                    r: {value : innerCircleRadius +  Math.random() * 10},
                })));
            });


            var node = svgContainer
                .append("g")
                .attr("class", "nodes")
                .selectAll("circle")
                .data(nodes)
                .join("g")
                .attr("class", n => n.universe)
                .append("circle")
                .attr("r", n => n.r)
                .attr("cx", n => foci[n.universe].x)
                .attr("cy", n => foci[n.universe].y)
                .attr("fill", n => colors[n.universe])
                .on("mouseover", (event, data) => {
                    tooltip
                        .transition()
                        .duration(transitionDuration)
                        .style('opacity', 0.9)
                        .style("display", "block");
                    tooltip.html(`<text>
                                <b>Exclusive in: ${inclusive_intersections[data.universe].name}</b></br>
                                <b>Name</b>: ${data.name} </br>
                                <b>Code Size</b>: ${(data.r).toFixed(2)} MB </br>
                                </text>`);
                })
                .on("mousemove", function (event, data) {
                    tooltip
                        .style('left', event.pageX + tooltipOffSet + 'px')
                        .style('top', event.pageY + 'px');
                })

                .on("mouseleave", (event, data) => {
                    tooltip
                        .transition()
                        .duration(transitionDuration)
                        .style('display', "none");
                });

            const simulation = d3.forceSimulation(nodes)
                .alphaTarget(0.03) // stay hot -> take out for better performance!
                .velocityDecay(0.12) // low friction
                .force("center", d3.forceCenter(0.53 * bubble_svg_width , 0.53 * bubble_svg_height))
                .force("charge", d3.forceManyBody())
                .force("x", d3.forceX().strength(0.12))
                .force("y", d3.forceY().strength(0.12))
                .force("collide", d3.forceCollide().radius((d:any) => d.r + 0.5))
                .on("tick", ticked);

            function ticked() {

                var k = this.alpha() * 0.2; //higher -> nodes want to get close to center
                //move the nodes to their foci/cluster
                nodes.forEach(function(n, i) {
                    n.y += (foci[n.universe].y - n.y) * k;
                    n.x += (foci[n.universe].x - n.x) * k;
                });
                //update coordinates for the circle
                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            }

            // FORCE END

            // text area and search
            const search = d3.select("#search");
            let typingTimer:any;
            let doneTypingInterval = 500;

            search.on('keyup', function () {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(highlightSearch, doneTypingInterval);
            });

            search.on('keydown', function () {
                clearTimeout(typingTimer);
            });

            function highlightSearch () {
                node
                    .transition()
                    .duration(transitionDuration)
                    .style("opacity", d => d.name.includes(search.node().value) ? 1: 0.4);
            }

            // Pie
            const pie_div = d3.selectAll("#pie")
                .append("svg")
                .append("g")
                .attr("transform", `translate(${[100, 75]})`);

            const pie = d3.pie()
                .value(function(d) {return d[1].packages.length});
            const pieData = pie(Object.entries(exclusive_intersections));
            const radius = 70;

            pie_div
                .selectAll('whatever')
                .data(pieData)
                .join('path')
                .attr('d', d3.arc()
                    .innerRadius(0)
                    .outerRadius(radius)
                )
                .attr("fill", d  => colors[getVennIntersectionIndex(d.data[1].name)])
                .attr("stroke", "black")
                .style("stroke-width", "1px")
                .style("opacity", 0.7)
                .on("mouseover", (event, data: any) => {
                    tooltip.style("display", "block");
                    tooltip.html(`<text>
                                <b>${data.data[1].name}</b></br>
                                Contributes: ${(data.data[1].packages.length/num_packages).toFixed(4) * 100}% </br>
                                </text>`);
                })
                .on("mousemove", function (event, data) {
                    tooltip
                        .style('left', event.pageX + tooltipOffSet + 'px')
                        .style('top', event.pageY + 'px');
                })

                .on("mouseleave", (event, data) => {
                    tooltip.style('display', "none");
                });


            d3.selectAll("#pie")
                .append("text")
                .text("Number of packages: " + num_packages);

            // text below
            exclusive_intersections
                .sort((a,b) => d3.descending(a.packages.length,b.packages.length))
                .forEach(i => {
                    d3.selectAll("#pie")
                        .append("text")
                        .text("" + i.name + ": " + i.packages.length);
                })


            function getVennIntersectionIndex(name:string) {
                return inclusive_intersections.findIndex(universe =>
                    sameMembers(universe.name.split(SEPARATOR), name.split(SEPARATOR)) );
            }

            function exclusiveIndexToInclusive(index:number) {
                let element = exclusive_intersections[index].name;
                return getVennIntersectionIndex(element);
            }
        }).catch(function(err) {
            console.log(err);
        })
    }
}