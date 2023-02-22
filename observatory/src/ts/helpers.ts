/**
 * A helper function that works similar to Array.map
 *
 * It creates a new object and iterates over its entries.
 * For each key and value, the `mapFunction` is executed.
 * The result of the `mapFunction` is stored in the new object at the previous key.
 *
 * @param {Record<string, any>} object
 * the object to iterate over
 *
 * @param {(key: string, value: any) => any} mapFunction
 * the function that maps the object's values to new ones
 *
 * @return {Record<string, any>}
 * a new object where the keys stay the same
 * and the values are generated by the `mapFunction`
 */
export function objectMap<T>(
    object: Record<string, any>,
    mapFunction: (key: string, value: any) => T
): Record<string, T> {
    return Object.keys(object).reduce((result: Record<string, T>, key: string) => {
        result[key] = mapFunction(key, object[key])
        return result
    }, {})
}
