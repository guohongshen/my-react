import { Key, Props, ReactElement } from "shared/ReactTypes";
import { FiberNode, createWorkInProgress } from "./fiber";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import { Fragment, FunctionComponent, HostComponent, HostText, WorkTag } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

type ExistingChildren = Map<Key, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
    function deleteChild (returnFiber: FiberNode, childToDelete: FiberNode) {
        if (!shouldTrackEffects) {
            return;
        }
        const deletions = returnFiber.deletions;
        if (deletions === null) {
            returnFiber.deletions = [childToDelete];
            returnFiber.flags |= ChildDeletion;
        } else {
            deletions.push(childToDelete);
            // deletions 不为空说明 flags 中已经有 ChildDeletion 了，不必要再加了
        }
    }
    function deleteRemainingChildren(
        returnFiber: FiberNode,
        currentFirstChild: FiberNode | null
    ) {
        if (!shouldTrackEffects) return;
        let childToDelete = currentFirstChild;
        while (childToDelete !== null) {
            deleteChild(returnFiber, childToDelete);
            childToDelete = childToDelete.sibling;
        }
    }
    function reconcileSingleElement(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        element: ReactElement
    ) {
        const key = element.key;
        while (currentFiber !== null) {
            // update
            if (currentFiber.key === key) {// key 相同
                if (element.$$typeof === REACT_ELEMENT_TYPE) {
                    if (currentFiber.type === element.type) {
                        let props = element.props;
                        if (element.type === REACT_FRAGMENT_TYPE) {
                            // 注意：带有 key 的 Fragment，其 props 就是 children；
                            // 但是如果没有 key，那就不会创建 Fragment fiber
                            props = element.props.children;
                        }
                        // type 相同
                        const existing = useFiber(currentFiber, props);
                        existing.return = returnFiber;
                        // 当前节点可复用，标记剩下的节点删除
                        deleteRemainingChildren(returnFiber, existing.sibling);
                        return existing;
                    }
                    // key 相同，删除所有旧的节点
                    deleteRemainingChildren(returnFiber, currentFiber);
                    // 删掉后，就进入到下面的代码，进行创建新的
                    break;
                } else {
                    if (__DEV__) {
                        console.log('还未实现的 ReactElement 类型');
                    }
                    break;
                }
            } else {
                // key 不同，就删掉旧的
                deleteChild(returnFiber, currentFiber);
                // 继续遍历其他的兄弟节点
                currentFiber = currentFiber.sibling;
            }
        }
        // 根据 element
        let fiber;
        if (element.type === REACT_FRAGMENT_TYPE) {
            fiber = createFiberFromFragment(element.props.children, key);
        } else {
            fiber = createFiberFromElement(element);
        }
        fiber.return = returnFiber;
        return fiber;
    }
    function reconcileSingleTextNode(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        content: string | number
    ) {
        while (currentFiber !== null) { // update
            if (currentFiber.tag === HostText) {
                // 类型没变，可以复用
                const existing = useFiber(currentFiber, { content });
                existing.return = returnFiber;
                deleteRemainingChildren(returnFiber, currentFiber.sibling);
                return existing;
            }
            deleteChild(returnFiber, currentFiber); // <div> -> 123123
            currentFiber = currentFiber.sibling;
        }
        const fiber = new FiberNode(
            HostText, 
            {content},
            null
        )
        fiber.return = returnFiber;
        return fiber;
    }
    function placeSingleChild(fiber: FiberNode) {
        if (shouldTrackEffects && fiber.alternate === null) {
            fiber.flags |= Placement;
        }
        return fiber;
    }
    function updateFromMap(
        returnFiber: FiberNode,
        existingChildren: ExistingChildren,
        index: number,
        element: any
    ): FiberNode | null {
        const key = element.key !== null ? element.key : index;
        const before = existingChildren.get(key);
        if (typeof element === 'string' || typeof element === 'number') {
            // HostText
            if (before) {
                if (before.tag === HostText) {
                    existingChildren.delete(key);
                    return useFiber(before, { content: element + '' });
                }
            }
            return new FiberNode(
                HostText,
                { content: element + '' },
                null
            );
        }

        // ReactElement
        if (typeof element === 'object' && element !== null) {
            switch (element.$$typeof) {
                case REACT_ELEMENT_TYPE:
                    if (element.type === REACT_FRAGMENT_TYPE) {
                        return updateFragment(
                            returnFiber,
                            before,
                            element, // QUESTION 显然是个数组，既然是数组，那就没有 $$typeof 属性吧
                            key,
                            existingChildren
                        );
                    }
                    if (before) {
                        if (before.type === element.type) {
                            // 可以复用
                            existingChildren.delete(key);
                            return useFiber(before, element.props);
                        }
                    }
                    return createFiberFromElement(element);
            }

            if (Array.isArray(element)) {
                return updateFragment(
                    returnFiber,
                    before,
                    element,
                    key,
                    existingChildren
                );
            }
        }

        return null;
    }
    function reconcileChildrenArray(
        returnFiber: FiberNode,
        currentFirstChild: FiberNode | null,
        /**
         * 虽然在我们这个项目中，这里是 ReactElement，但是实际 React 有很多其他类型，
         * 所以这里用 any。
         */
        newChild: any[]
    ): FiberNode {
        let node: FiberNode | null = null;
        /**
         * 当下遍历到的最后一个可复用 fiber 的旧 index（也即在 current 中的位置）
         */
        let lastPlacedIndex: number = 0;
        /**
         * 随着遍历而构建中的新 fiber 链表的表尾
         */
        let lastNewFiber: FiberNode | null = null;
        /**
         * 随着遍历而构建中的新 fiber 链表的表尾的表头。协调完后，需要返回它
         */
        let firstNewFiber: FiberNode | null = null;
        // 1. 将 current 保存在 map 中
        const existingChildren: ExistingChildren = new Map();
        let current = currentFirstChild;
        while (current !== null) {
            const keyToUse = current.key !== null
                ? current.key // 有 key 用 key
                : current.index; // 无 key 用 index 
            existingChildren.set(keyToUse, current);
            current = current.sibling;
        }
        // 2. 遍历 newChild 查看是否可复用
        for (let i = 0; i< newChild.length; ++i) {
            const el = newChild[i];
            const newFiber = updateFromMap(
                returnFiber,
                existingChildren,
                i,
                el
            );

            if (newFiber === null) { // any -> false null 等不是 string、number 
                // 或者 object 的情况
                continue;
            }

            // 3. 标记移动还是插入
            newFiber.index = i; // 注意 newFiber 的 index 正是在这里做赋值的
            newFiber.return = returnFiber;

            if (lastNewFiber === null) {
                lastNewFiber = newFiber;
                firstNewFiber = newFiber;
            } else {
                lastNewFiber.sibling = newFiber;
                lastNewFiber = newFiber;
            }

            if (!shouldTrackEffects) continue;

            const current = newFiber.alternate;
            if (current !== null) {
                const oldIndex = current.index;
                if (oldIndex < lastPlacedIndex) {
                    newFiber.flags |= Placement; // 移动
                    continue;
                } else {
                    // 不移动
                    lastPlacedIndex = oldIndex;
                }
            } else {
                // mount
                newFiber.flags |= Placement;
            }
        }
        // 4. 将 map 中剩下的标记为删除
        existingChildren.forEach(child => {
            deleteChild(returnFiber, child);
        });

        return firstNewFiber as FiberNode;
    }
    return function reconcileChildFibers(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        /**
         * ReactElement | any[]
         */
        newChild?: any
    ) {
        // 判断 Fragment
        const isUnkeyedTopLevelFragment = typeof newChild === 'object' &&
            newChild !== null &&
            newChild.type === REACT_FRAGMENT_TYPE &&
            newChild.key === null;
        if (isUnkeyedTopLevelFragment) {
            /*
                处理这种情况：
                <div>
                    <>
                        <div/>
                        <div/>
                        <div/>
                    </>
                </div>
             */
            newChild = newChild?.props.children;
        }

        // 判断当前 fiber 的类型
        if (typeof newChild === "object" && newChild !== null) {
            // 多节点的情况
            if (Array.isArray(newChild)) {
                return reconcileChildrenArray(
                    returnFiber,
                    currentFiber,
                    newChild
                );
            }
            switch (newChild.$$typeof) {
                case REACT_ELEMENT_TYPE:
                    return placeSingleChild(reconcileSingleElement(
                        returnFiber,
                        currentFiber,
                        newChild
                    ));
                default:
                    if (__DEV__) {
                        console.warn('未实现的 reconcile 类型');
                    }
                    break;
            }
        }

        // newChild is a HostText
        if (typeof newChild === 'string' || typeof newChild === 'number') {
            return placeSingleChild(
                reconcileSingleTextNode(
                    returnFiber,
                    currentFiber,
                    newChild
                )
            );
        }

        // 兜底：
        if (currentFiber !== null) {
            // 兜底 做删除
            deleteRemainingChildren(returnFiber, currentFiber);
        }

        if (__DEV__) {
            console.warn('未实现的 reconcile 类型', newChild);
        }

        return null;
    }
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

export function createFiberFromElement(element: ReactElement): FiberNode {
    const { type, key, props } = element;
    let fiberTag: WorkTag = FunctionComponent;

    if (typeof type === 'string') {
        // <div/> type: 'div
        fiberTag = HostComponent;
    } else if (typeof type !== 'function' && __DEV__) {
        console.warn('未定义的 type 类型', type);
    }
    const fiber = new FiberNode(fiberTag, props, key);
    fiber.type = type;
    return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key) {
    const fiber = new FiberNode(Fragment, elements, key);
    fiber.type = REACT_FRAGMENT_TYPE;
    return fiber;
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0; // 当前仅支持单一孩子节点
    clone.sibling = null;
    return clone;
}

function updateFragment(
    returnFiber: FiberNode,
    current: FiberNode | undefined,
    elements: any[],
    key: Key,
    existingChildren: ExistingChildren
) {
    let fiber;
    if (!current || current.tag !== Fragment) {
        fiber = createFiberFromFragment(elements, key);
    } else {
        existingChildren.delete(key);
        fiber = useFiber(current, elements);
    }
    fiber.return = returnFiber;
    return fiber;
}
