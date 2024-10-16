import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { Type, Key, Ref, Props, ReactElement, ElementTpe } from "shared/ReactTypes";

const createReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElement {
    const element = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref,
        props,
        __mark: 'hongshen.guo'
    };
    return element;
}

export const jsx = function (type: ElementTpe, config: any, ...maybeChildren: any) {
    let key: Key = null;
    const props: Props = {};
    let ref: Ref = null;

    for (const prop in config) {
        const val = config[prop];
        if (prop === 'key') {
            if (val !== undefined) {
                key = '' + val;
            }
            continue;
        }
        if (prop === 'ref') {
            if (val !== undefined) {
                ref = val;
            }
            continue;
        }
        if (Object.hasOwnProperty.call(config, prop)) {
            props[prop] = val;
        }
    }

    const maybeChildrenLength = maybeChildren.length;
    if (maybeChildrenLength) {
        if (maybeChildrenLength === 1) {
            props.children = maybeChildren[0];
        } else {
            props.children = maybeChildren;
        }
    }

    return createReactElement(type, key, ref, props);
}


export const jsxDEV = function (type: ElementTpe, config: any, _key: Key) {
    const props: Props = {};
    let ref: Ref = null;

    for (const prop in config) {
        const val = config[prop];
        if (prop === 'ref') {
            if (val !== undefined) {
                ref = val;
            }
            continue;
        }
        if (Object.hasOwnProperty.call(config, prop)) {
            props[prop] = val;
        }
    }

    const key = _key === undefined ? null : _key; // key 如果没有值就默认给 null
    // 不然 reconcile 的时候有些代码就会拿 null 和 undefined 比较，得出 key 不同
    
    return createReactElement(type, key, ref, props);
}

export function isValidElement(object: any) {
    return typeof object === 'object' &&
        object !== null &&
        object.$$typeof === REACT_ELEMENT_TYPE
}
