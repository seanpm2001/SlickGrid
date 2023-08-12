import type { MenuItem } from './menuItem.interface';
import type { MenuCommandItemCallbackArgs } from './menuCommandItemCallbackArgs.interface';
import type { MenuCallbackArgs } from './menuCallbackArgs.interface';
import type { SlickEventData } from '../slick.core';
export interface MenuCommandItem<A = MenuCommandItemCallbackArgs, R = MenuCallbackArgs> extends MenuItem<R> {
    /** A command identifier to be passed to the onCommand event callback handler (when using "commandItems"). */
    command: string;
    /** Optionally define a callback function that gets executed when item is chosen (and/or use the onCommand event) */
    action?: (event: SlickEventData | Event, callbackArgs: A) => void;
}