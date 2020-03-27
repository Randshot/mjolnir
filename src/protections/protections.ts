/*
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { FirstMessageIsImage } from "./FirstMessageIsImage";
import { IProtection } from "./IProtection";
import { BasicFlooding, MAX_PER_MINUTE } from "./BasicFlooding";
import { ShortFlooding, SHORT_MAX_PER_INTERVAL, SHORT_INTERVAL } from "./ShortFlooding";

export const PROTECTIONS: PossibleProtections = {
    [new FirstMessageIsImage().name]: {
        description: "If the first thing a user does after joining is to post an image or video, " +
            "they'll be banned for spam. This does not publish the ban to any of your ban lists.",
        factory: () => new FirstMessageIsImage(),
    },
    [new BasicFlooding().name]: {
        description: "If a user posts more than " + MAX_PER_MINUTE + " messages in 60s they'll be " +
            "banned for spam. This does not publish the ban to any of your ban lists.",
        factory: () => new BasicFlooding(),
    },
    [new ShortFlooding().name]: {
        description: "If a user posts more than " + SHORT_MAX_PER_INTERVAL + " messages in " + SHORT_INTERVAL * 0.001 + "s they'll be " +
            "kicked for spam. This does not publish the kick to any of your ban lists.",
        factory: () => new ShortFlooding(),
    }
};

export interface PossibleProtections {
    [name: string]: {
        description: string;
        factory: () => IProtection;
    };
}
