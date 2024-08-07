import { Container } from "hostConfig";
import scheduler, { Priority } from "scheduler";
import { Props } from "shared/ReactTypes";


export const elementPropsKey = '__props';
export const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
    __stopPropagation: boolean;
}

interface Paths {
    capture: EventCallback[];
    bubble: EventCallback[];
}

export interface DOMElement extends Element {
    [elementPropsKey]?: Props;
}

export function injectProps(
    node: DOMElement,
    props: Props
) {
    node[elementPropsKey] = props;
}

export function initEvent(
    container: Container,
    eventType: string
) {
    if (!validEventTypeList.includes(eventType)) {
        console.warn('当前不支持', eventType, '事件');
    }
    if (__DEV__) {
        console.log('初始化事件', eventType);
    }
    container.addEventListener(eventType, (e: any)=> {
        dispatchEvent(container, eventType, e)
    });
}

function createSyntheticEvent(e: Event) {
    const syntheticEvent = e as SyntheticEvent;
    syntheticEvent.__stopPropagation = false;
    const originStopPropagation = e.stopPropagation;

    syntheticEvent.stopPropagation = () => {
        syntheticEvent.__stopPropagation = true;
        if (!!originStopPropagation) {
            originStopPropagation();
        }
    }

    return syntheticEvent;
}

function dispatchEvent(
    container: Container,
    eventType: string,
    e: Event
) {
    const targetElement = e.target;
    if (targetElement === null) {
        console.warn('事件不存在 target', e);
        return;
    }
    // 1. 收集沿途事件
    const { capture, bubble } = collectPaths(
        targetElement as DOMElement,
        container,
        eventType
    );
    
    // 2. 构造合成事件
    const se = createSyntheticEvent(e);
    // 3. 遍历 capture
    triggerEventFlow(capture, se);

    if (!se.__stopPropagation) {
        // 4. 遍历 bubble
        triggerEventFlow(bubble, se);
    }
}

function triggerEventFlow(
    paths: EventCallback[],
    se: SyntheticEvent
) {
    for (let i = 0; i< paths.length; ++i) {
        const callback = paths[i];
        scheduler.runWithPriority(
            eventTypeToSchedulerPriority(se.type), // 1
            () => {
                callback.call(null, se);
            }
        );
        if (se.__stopPropagation) {
            break;
        }
    }
}

function getEventCallbackNameFromEventType(
    eventType: string
): string[] | undefined {
    return {
        click: ['onCLickCapture', 'onClick']
    }[eventType];
}

function collectPaths(
    targetElement: DOMElement,
    container: Container,
    eventType: string
) {
    const paths: Paths = {
        capture: [],
        bubble: []
    };

    while (targetElement && targetElement !== container) {
        // 收集
        const elementProps = targetElement[elementPropsKey];
        if (elementProps) {
            const callbackNameList = getEventCallbackNameFromEventType(eventType);
            if (callbackNameList) {
                callbackNameList.forEach((name, i) => {
                    const eventCallback = elementProps[name]
                    if (eventCallback) {
                        if (i === 0) {
                            // capture
                            paths.capture.unshift(eventCallback)
                        } else {
                            paths.bubble.push(eventCallback);
                        }
                    }
                })
            }
        }
        targetElement = targetElement.parentNode as DOMElement;
    }
    return paths;
}

function eventTypeToSchedulerPriority(eventType: string) {
    switch (eventType) {
        case 'click':
        case 'keydown':
        case 'keyup':
            return Priority.ImmediatePriority;
        case 'scroll':
            return Priority.UserBlockingPriority;
        default:
            return Priority.NormalPriority;
    }
}
