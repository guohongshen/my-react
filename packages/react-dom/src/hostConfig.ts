import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";

export type Container = Element;
export type Instance = Element;
export type textInstance = Text;

export function createInstance (type: string, props?: any): Instance {
    // TODO 处理 props
    const element = document.createElement(type);
    return element;
}

export function appendInitialChild(parent: Instance | Container, child: Instance) {
    parent.appendChild(child);
}

export function createTextInstance(content: string) {
    return document.createTextNode(content);
}

export function appendChildToContainer(child: any, container: Container) {
    return appendInitialChild(container, child);
}

export function commitUpdate(fiber: FiberNode) {
    switch (fiber.tag) {
        case HostText:
            const text = fiber.memoizedProps.content;
            return commitTextUpdate(fiber.stateNode, text);
        default:
            if (__DEV__) {
                console.warn('未实现的 Update 类型, fiber');
            }
            break;
    }
}

export function commitTextUpdate(textInstance: textInstance, content: string) {
    textInstance.textContent = content;
}

export function removeChild(
    child: Instance | textInstance,
    container: Container
) {
    console.log('child: ',child);
    console.log('container: ', container);
    container.removeChild(child);
}
