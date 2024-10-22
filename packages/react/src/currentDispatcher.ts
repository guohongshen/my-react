import { HookDeps } from "react-reconciler/src/fiberHooks";
import { Action, ReactContext, Usable } from "shared/ReactTypes";

export type Dispatch<State> = (action: Action<State>) => void;

export interface Dispatcher {
    useState: <T>(initialState: (T | (() => T))) => [T, Dispatch<T>];
    useEffect: (callback: () => void | void, deps: any[] | void) => void;
    useTransition: () => [boolean, (callback: () => void) => void];
    useRef: <T>(initialValue: T) => { current: T };
    useContext: <T>(context: ReactContext<T>) => T;
    use: <T>(usable: Usable<T>) => T;
    useMemo: <T>(nextCreate: () => T, deps: HookDeps | undefined) => T;
    useCallback: <T>(callback: T, deps: HookDeps | undefined) => T;
}

const currentDispatcher: {
    current: Dispatcher | null;
} = {
    current: null
};

export const resolveDispatcher = (): Dispatcher => {
    const dispatcher = currentDispatcher.current;

    if (dispatcher === null) {
        throw new Error('hook 只能在函数组件中执行');
    }

    return dispatcher;
}

export default currentDispatcher;
