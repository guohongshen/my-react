import { Container, Instance, appendChildToContainer, commitUpdate, insertBefore, removeChild } from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import { ChildDeletion, Flags, MutationMask, NoFlags, PassiveEffect, PassiveMask, Placement, Update } from "./fiberFlags";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { ExecFileOptionsWithBufferEncoding } from "child_process";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTag";

let nextEffect: FiberNode | null = null;

/**
 * 利用 DFS 和 subtreeFlags 完成 mutation。
 * @param finishedWork 
 */
export function commitMutationEffects(finishedWork: FiberNode, root: FiberRootNode) {
    nextEffect = finishedWork;
    // 两个 while 实现 DFS:
    while (nextEffect !== null) { // 这个 while 是用来向下遍历的
        const child: FiberNode | null = nextEffect.child;

        if (
            (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
            child !== null
        ) {
            nextEffect = child;
        } else {
            up: while (nextEffect !== null) { // 这个 while 是用来向上遍历的
                commitMutationEffectsOnFiber(nextEffect, root);
                const sibling: FiberNode | null = nextEffect.sibling;
                if (sibling) {
                    nextEffect = sibling;
                    break up;
                }
                nextEffect = nextEffect.return;
            }
        }
    }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
    const flags = finishedWork.flags;
    if ((flags & Placement) !== NoFlags) {
        commitPlacement(finishedWork);

        finishedWork.flags &= ~Placement; // 移除 Placement
    }
    if ((flags & Update) !== NoFlags) {
        commitUpdate(finishedWork);

        finishedWork.flags &= ~Update; // 移除 Update
    }
    if ((flags & ChildDeletion) !== NoFlags) {
        const deletions = finishedWork.deletions;
        if (deletions !== null) {
            deletions.forEach(child => {
                commitDeletion(child, root);
            });
        }
        
        finishedWork.flags &= ~ChildDeletion; // 移除 ChildDeletion
    }

    if ((flags & PassiveEffect) !== NoFlags) {
        // 收集回调
        commitPassiveEffect(
            finishedWork,
            root,
            'update'
        );
        finishedWork.flags &= ~PassiveEffect;
    }
}

function commitPlacement(finishedWork: FiberNode) {
    if (__DEV__) {
        // console.warn('执行 Placement 操作', finishedWork);
        // debugger;
    }
    // 找到 parent DOM
    const hostParent = getHostParent(finishedWork);

    // host sibling
    const hostSibling = getHostSibling(finishedWork);

    // finishedWork ~ DOM
    if (hostParent !== null) {
        insertBeforeOrAppendPlacementNodeIntoContainer(
            finishedWork,
            hostParent,
            hostSibling
        );
    }
}

/**
 * 也即：移除以 childToDelete 为根节点的子树。由于子树中：
 * <1> 对于 FC，需要处理 useEffect unmount 执行、解绑 ref；
 * <2> 对于 HostComponent，需要解绑 ref；
 * <3> 对于子树中所有以 HostComponent 为根的子树，需要移除其根的 DOM 节点；
 * 那么本函数(commitDeletion)一定是递归的，递归的遍历这棵子树。
 * @param childToDelete 
 */
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
    let rootChildrenToDelete: FiberNode[] = [];
    function recordHostChildrenToDelete(
        childrenToDelete: FiberNode[],
        unmountFiber: FiberNode
    ) {
        // 1. 找到第一个 root host 节点
        let lastOne = childrenToDelete[childrenToDelete.length - 1];
        if (!lastOne) {
            childrenToDelete.push(unmountFiber);
        } else {
            // 2. 每找到一个节点，判断是不是 1 找到的那个节点的兄弟节点
            let node = lastOne.sibling;
            while (node !== null) {
                if (unmountFiber === node) {
                    childrenToDelete.push(unmountFiber);
                }
                node = node.sibling;
            }
        }
    }
    // 递归子树
    commitNestedComponent(childToDelete, unmountFiber => {
        switch (unmountFiber.tag) {
            case HostComponent:
                recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
                // TODO 解绑 ref
                return;
            case HostText:
                recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
                return;
            case FunctionComponent:
                // TODO useEffect、unmount、解绑 ref
                commitPassiveEffect(
                    unmountFiber,
                    root,
                    'unmount'
                );
                return;
            default:
                if (__DEV__) {
                    console.warn('未处理的 unmount 类型', unmountFiber);
                }
                break;
        }
    });

    // 移除 rootHostNode 的 DOM
    if (rootChildrenToDelete.length !== 0) {
        const hostParent = getHostParent(childToDelete); // child text
        // 单一节点，只考虑有一个子树的情况
        if (hostParent !== null) {
            rootChildrenToDelete.forEach(childToDelete => {
                removeChild((childToDelete).stateNode, hostParent);
            });
        }
    }
    childToDelete.return = null;
    childToDelete.child = null;
}

function commitPassiveEffect(
    fiber: FiberNode,
    root: FiberRootNode,
    type: keyof PendingPassiveEffects
) {
    // 常规的类型检查
    if (
        fiber.tag !== FunctionComponent || // 非函数组件
        (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags) // type 为 update，却没有 PassiveEffect 标志，属于异常
    ) {
        return;
    }
    
    const updateQueue = fiber.updateQueue as FCUpdateQueue;
    if (updateQueue !== null) {
        if (updateQueue.lastEffect === null) {
            __DEV__ && console.warn('当 FC 存在 PAssiveEffect flag 时，不应该不存在 lastEffect');
        } else {
            root.pendingPassiveEffects[type].push(
                updateQueue.lastEffect // 只需要 push lastEffect 就行了，因为
                // lastEffect 对应的是那条环状链表，之后我们再遍历那条环状链表就能执行
                // 这个函数组件下所有的 effect 回调。
            );
        }
    }
}

function commitHookEffectList(
    flags: Flags,
    lastEffect: Effect,
    callback: (effect: Effect) => void
) {
    let effect = lastEffect.next as Effect;

    do {
        if ((effect.tag & flags) === flags) {
            callback(effect);
        }
        effect = effect.next as Effect;
    } while (effect !== lastEffect.next);
}

/**
 * 组件卸载，执行 destroy，destroy 对应依赖数组为空的 effect hook 的 destroy
 * @param flags 
 * @param lastEffect 
 * @param callback 
 */
export function commitHookEffectListUnmount(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const destroy = effect.destroy;
        if (typeof destroy === 'function') {
            destroy();
        }
        effect.tag &= ~ HookHasEffect; // 既然已经卸载，就不需要后续的触发流程了
    });
}

/**
 * 触发所有上次更新的 destroy，destroy 对应依赖数组不为空的 effect hook 的 destroy
 * @param flags 
 * @param lastEffect 
 */
export function commitHookEffectListDestroy(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const destroy = effect.destroy;
        if (typeof destroy === 'function') {
            destroy();
        }
    });
}

/**
 * 执行所有的 create
 * @param flags 
 * @param lastEffect 
 */
export  function commitHookEffectListCreate(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const create = effect.create;
        if (typeof create === 'function') {
            effect.destroy = create();
        }
    });
}


/**
 * 深度优先遍历，前序调用 onCommitUnmount()
 * @param root 
 * @param onCommitUnmount 
 * @returns 
 */
function commitNestedComponent(
    root: FiberNode,
    onCommitUnmount: (fiber: FiberNode) => void
) {
    let node = root;
    while (true) {
        onCommitUnmount(node);

        if (node.child !== null) {
            node.child.return = node;
            node = node.child;
            continue;
        }
        if (node === root) {
            return;
        }
        while (node.sibling === null) {
            if (node.return === null || node.return === root) {
                return;
            }
            node = node.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
    /*node = root;
    function toLeave(n: FiberNode) {
        while (n.child !== null) {
            n = n.child;
        }
        return n;
    };
    node = toLeave(node);
    // node 现在是叶子节点
    while (true) {
        onCommitUnmount(node);
        if (node === root) return;
        if (node.sibling !== null) {
            node = toLeave(node.sibling);
            continue;
        } else {
            if (node.return === null) { // 应付类型检查
                return;
            } else {
                node = node.return;
            }
        }
    }*/
}

/**
 * 返回 fiber 的「后驱 Host 节点，后驱肯定就要求是兄弟了」，不稳定的除外。不稳定是指携
 * 带 Placement flag。
 * @param fiber 
 */
function getHostSibling(fiber: FiberNode): Instance | null {
    let node = fiber;
    function isStable(fiber: FiberNode) {
        return (fiber.flags & Placement) === NoFlags;
    }
    findSibling: while (true) {
        while (node.sibling === null) {
            const parent = node.return;
            if (parent === null ||
                parent.tag === HostComponent || // QUESTION
                parent.tag === HostRoot // HostRot 没有兄弟节点，所以不用找了
            ) {
                return null;
            }
            node = parent;
        }
        node.sibling.return = node.return;
        node = node.sibling;
        
        while (node.tag !== HostText && node.tag !== HostComponent) {
            // 向下遍历
            if (!isStable(node)) {
                continue findSibling;
            }
            if (node.child === null) {
                continue findSibling;
            } else {
                node.child.return = node;
                node = node.child;
            }
        }

        // HostText or HostComponent
        if (isStable(node)) {
            return node.stateNode;
        }
    }
}

function getHostParent(fiber: FiberNode): Container | null {
    let parent = fiber.return;

    while (parent) {
        const parentTag = parent.tag;
        // hostComponent
        // hostRoot
        if (parentTag === HostComponent) {
            return parent.stateNode;
        }
        if (parentTag === HostRoot) {
            return (parent.stateNode as FiberRootNode).container;
        }
        parent = parent.return;
    }
    if (__DEV__) {
        console.warn('未找到 host parent');
    }
    return null;
}

function insertBeforeOrAppendPlacementNodeIntoContainer(
    finishedWork: FiberNode,
    hostParent: Container,
    hostSibling?: Instance | null
) {
    // fiber host
    if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
        if (hostSibling) {
            insertBefore(
                hostParent,
                finishedWork.stateNode,
                hostSibling
            );
        } else {
            appendChildToContainer(finishedWork.stateNode, hostParent);
        }
        return;
    }
    const child = finishedWork.child;
    if (child !== null) {
        insertBeforeOrAppendPlacementNodeIntoContainer(
            child,
            hostParent
        );
        let sibling = child.sibling;

        while (sibling !== null) {
            insertBeforeOrAppendPlacementNodeIntoContainer(
                sibling,
                hostParent
            );
            sibling = sibling.sibling;
        }
    }
}
