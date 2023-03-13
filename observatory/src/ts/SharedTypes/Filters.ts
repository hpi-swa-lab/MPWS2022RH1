import { Node } from '../UniverseTypes/Node'

export type NodeValidator = (node: Node) => boolean

type serializedFilter = {
    description: string
    appliesComplement: boolean
    validator: string
}

export class Filter {
    public description: string
    public validator: NodeValidator
    public applyComplement: boolean

    constructor(description: string, validator: NodeValidator, applyComplement = false) {
        this.description = description
        this.validator = validator
        this.applyComplement = applyComplement
    }

    static applyAll(filters: Filter[], node: Node): boolean {
        return filters.every((filter) => filter.validate(node))
    }

    static parse(json: string): Filter {
        const serialized = JSON.parse(json) as serializedFilter
        return new Filter(
            serialized.description,
            new Function('return ' + serialized.validator)(),
            serialized.appliesComplement
        )
    }

    public equals(another: Filter): boolean {
        // Comparison validity https://stackoverflow.com/a/9817699
        return (
            '' + this.validator === '' + another.validator &&
            this.description === another.description
        )
    }

    public validate(node: Node): boolean {
        return this.applyComplement ? !this.validator(node) : this.validator(node)
    }

    public serialize(): string {
        return `{"description":"${this.description}","applyComplement":${
            this.applyComplement
        }, "validator":"${this.validator.toString()}"}`
    }
}
