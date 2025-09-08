// map/js/routing/pathfinding.js - Pathfinding algorithms module

(function(window) {
    'use strict';

    /**
     * A* algorithm implementation for efficient pathfinding
     * Uses heuristic to guide search toward target
     */
    function findShortestPathAStar(graph, startNodeId, endNodeId) {
        if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
            console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`);
            return null;
        }

        const startNode = graph.nodes.get(startNodeId);
        const endNode = graph.nodes.get(endNodeId);
        
        // A* data structures
        const openSet = new Set([startNodeId]);
        const cameFrom = new Map();
        const gScore = new Map(); // Cost from start to node
        const fScore = new Map(); // gScore + heuristic

        // Initialize scores
        for (let nodeId of graph.nodes.keys()) {
            gScore.set(nodeId, Infinity);
            fScore.set(nodeId, Infinity);
        }
        gScore.set(startNodeId, 0);
        fScore.set(startNodeId, heuristic(startNode, endNode));

        while (openSet.size > 0) {
            // Find node in openSet with lowest fScore
            let current = null;
            let lowestF = Infinity;
            for (let nodeId of openSet) {
                const f = fScore.get(nodeId);
                if (f < lowestF) {
                    lowestF = f;
                    current = nodeId;
                }
            }

            if (current === endNodeId) {
                // Reconstruct path
                const path = [];
                let node = current;
                while (node !== undefined) {
                    path.unshift(node);
                    node = cameFrom.get(node);
                }
                return path;
            }

            openSet.delete(current);
            
            // Check all neighbors
            for (let edge of graph.edges) {
                if (edge.from === current) {
                    const neighbor = edge.to;
                    const tentativeGScore = gScore.get(current) + (edge.distance * edge.cost);
                    
                    if (tentativeGScore < gScore.get(neighbor)) {
                        cameFrom.set(neighbor, current);
                        gScore.set(neighbor, tentativeGScore);
                        
                        const neighborNode = graph.nodes.get(neighbor);
                        fScore.set(neighbor, tentativeGScore + heuristic(neighborNode, endNode));
                        
                        if (!openSet.has(neighbor)) {
                            openSet.add(neighbor);
                        }
                    }
                }
            }
        }

        return null; // No path found
    }

    /**
     * Heuristic function for A* (Euclidean distance)
     * Provides optimistic estimate of remaining cost to goal
     */
    function heuristic(nodeA, nodeB) {
        return Math.sqrt(
            Math.pow(nodeB.x - nodeA.x, 2) + 
            Math.pow(nodeB.y - nodeA.y, 2)
        );
    }

    /**
     * Dijkstra's algorithm implementation for pathfinding (fallback)
     * Guaranteed to find optimal path but slower than A*
     */
    function findShortestPath(graph, startNodeId, endNodeId) {
        if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
            console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`);
            return null;
        }

        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Initialize distances
        for (let nodeId of graph.nodes.keys()) {
            distances.set(nodeId, Infinity);
            unvisited.add(nodeId);
        }
        distances.set(startNodeId, 0);

        while (unvisited.size > 0) {
            // Find unvisited node with minimum distance
            let currentNode = null;
            let minDistance = Infinity;
            for (let nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    currentNode = nodeId;
                }
            }

            if (currentNode === null || minDistance === Infinity) {
                break; // No more reachable nodes
            }

            unvisited.delete(currentNode);

            if (currentNode === endNodeId) {
                break; // Found target
            }

            // Check all edges from current node
            for (let edge of graph.edges) {
                if (edge.from === currentNode && unvisited.has(edge.to)) {
                    const totalCost = edge.distance * edge.cost;
                    const altDistance = distances.get(currentNode) + totalCost;
                    
                    if (altDistance < distances.get(edge.to)) {
                        distances.set(edge.to, altDistance);
                        previous.set(edge.to, currentNode);
                    }
                }
            }
        }

        // Reconstruct path
        if (!previous.has(endNodeId)) {
            return null; // No path found
        }

        const path = [];
        let currentNode = endNodeId;
        while (currentNode !== undefined) {
            path.unshift(currentNode);
            currentNode = previous.get(currentNode);
        }

        return path;
    }

    /**
     * Compute total cost of graph path in weighted distance
     */
    function computeGraphPathCost(pathIds, edgeMap, kmPerPixel) {
        if (!pathIds || pathIds.length < 2) return 0;
        
        let totalCostPx = 0;
        
        for (let i = 1; i < pathIds.length; i++) {
            const edgeKey = `${pathIds[i-1]}|${pathIds[i]}`;
            const edge = edgeMap.get(edgeKey);
            
            if (!edge) {
                console.warn(`Missing edge: ${edgeKey}`);
                return Infinity;
            }
            
            totalCostPx += edge.distance * edge.cost;
        }
        
        return totalCostPx * kmPerPixel;
    }

    // Expose module functions
    window.__nimea_pathfinding = {
        findShortestPathAStar,
        findShortestPath,
        heuristic,
        computeGraphPathCost
    };

})(window);