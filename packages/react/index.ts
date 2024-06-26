import { Dispatcher, resolveDispatcher } from "./src/currentDispatcher";
import currentDispatcher from "./src/currentDispatcher";
import { jsxDEV, jsx, isValidElement as _isValidElement, Fragment as _Fragment } from "./src/jsx";

export const useState: Dispatcher['useState'] = (initialState) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useEffect(create, deps);
};

/** 数据共享层 */
export const Sharing = {
    currentDispatcher
};

export const version = '0.0.0';

// TODO 根据环境区分 jsx 还是 jsxDEV
export const createElement = jsxDEV;

export const isValidElement = _isValidElement;

export const Fragment = _Fragment;
