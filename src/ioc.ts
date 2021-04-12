import 'reflect-metadata';
import * as Util from './util'

// ---------------------------------------------------------------------------------
const g = global || window
if (!g) {
    throw new Error('Rocker should be used in nodejs or browser.')
}
var globalProviders: WeakMap<FunctionConstructor, Function> = g['__rocker_providers__'];
if (!g['__rocker_providers__']) {
    globalProviders = g['__rocker_providers__'] = new WeakMap()
}

/**
 * Inject an object into  property|param
 * @param args decorator's params
 * @returns {any}
 * @constructor
 */
export function Inject(...args: any[]): void | any {
    let params = args, fn = function(target: Function, key: string, name: string) {
        let dt = Reflect.getMetadata('design:type', target, key);
        if (!dt) {
            dt = Reflect.getMetadata('design:type', target.constructor, key);
        }
        injectProperty(target.constructor, key, dt, params);
        return;
    }
    if (args.length == 3
        && (typeof (args[0]) == 'object' && typeof (args[0]['constructor']) == 'function'//Instance property
            || typeof (args[0]) == 'function')//Class property
        && typeof (args[1]) == 'string') {//None parameters
        params = [];
        fn.apply(null, args);
    } else {
        return fn;
    }
}

/**
 * Provider for services
 * @param args decorator's params
 * @returns {any}
 * @constructor
 */
export function Provider(...args: any[]): void | any {
    if (args.length == 1) {
        if (Array.isArray(args[0])) {
            return function(target: Function) {
                args[0].forEach(type => {
                    if (typeof (type) !== 'function') {
                        throw new Error(`Type in Provider should be typeof function.`)
                    }
                    Container.provides([type, function() {
                        return new target();
                    }]);
                })
                return;
            }
        } else if (typeof (args[0]) == 'function') {
            Container.provides([args[0], function() {
                return new args[0]();
            }]);
        } else {
            throw new Error(`Type in Provider should be typeof function.`)
        }
    }
}

/**
 * IOC Container
 */
export class Container {
    /**
     * Sub container's providers
     */
    private myProviders: Map<FunctionConstructor, Function>;

    /**
     * Provid type's implements factory
     * @param {Function} classDefine
     */
    static provides(...defAry: (Function | [Function, Function])[]) {
        defAry.forEach((_def) => {
            if (Array.isArray(_def)) {
                if (!Util.isFunction(_def[0])) {
                    throw new Error('Invalid class type, must be a class.');
                }
                if (!Util.isFunction(_def[1])) {
                    throw new Error('Invalid factory type, must be a function.');
                }
                globalProviders.set(<FunctionConstructor>(_def[0]), _def[1]);
            } else {
                if (!Util.isFunction(_def)) {
                    throw new Error('Invalid Provider type, must be a class or a [class,function].');
                }
                let type = Util.getExtends(_def);
                globalProviders.set(type, function(...args) {
                    return factory(_def, ...args);
                })
            }
        })
    }
}

//---------------------------------------------------------------------------------------------

function injectProperty(target: Function, key: string, propertyType: Function, args: any[]) {
    const instanseName = `__${key}__`; // cache instanse
    Object.defineProperty(target.prototype, key, {
        enumerable: true,
        get: function() {
            let instanse = this[instanseName];
            if (!instanse) {
                let factoryFn = globalProviders.get(<FunctionConstructor>propertyType);
                if (factoryFn) {
                    instanse = factoryFn(...args);
                } else {
                    instanse = factory(propertyType, ...args);
                }
                this[instanseName] = instanse; // cache for singleton
            }
            return instanse;
        },
        set: function(properValue) {
            this[instanseName] = properValue;
        }
    });
}

function factory(fn: any, ...args: any[]) {
    try {
        if (args.length == 1 && typeof (args[0]) == 'function') {//Parameters factory
            args = args[0]();
        }
        return new fn(...args);
    } catch (e) {
        throw new Error('New instance of class\n\n' + fn + '\n,parameters:[' + args + '] error, message:' + e.toString());
    }
}
