export class UndirectedGraph<T extends string> {
  private readonly adjacency = new Map<T, Set<T>>()

  addVertex(vertex: T): void {
    if (!this.adjacency.has(vertex)) {
      this.adjacency.set(vertex, new Set())
    }
  }

  addEdge(a: T, b: T): void {
    this.addVertex(a)
    this.addVertex(b)
    this.adjacency.get(a)?.add(b)
    this.adjacency.get(b)?.add(a)
  }

  connectedComponents(): T[][] {
    const visited = new Set<T>()
    const components: T[][] = []

    for (const vertex of this.adjacency.keys()) {
      if (visited.has(vertex)) {
        continue
      }

      const component: T[] = []
      const stack = [vertex]
      visited.add(vertex)

      while (stack.length > 0) {
        const current = stack.pop()

        if (!current) {
          continue
        }

        component.push(current)

        for (const neighbor of this.adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            stack.push(neighbor)
          }
        }
      }

      components.push(component)
    }

    return components
  }
}
