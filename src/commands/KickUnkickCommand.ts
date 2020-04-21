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

import { Mjolnir } from "../Mjolnir";
import BanList, { RULE_USER } from "../models/BanList";
import { LogService, RichReply } from "matrix-bot-sdk";
import { RECOMMENDATION_KICK, recommendationToStable } from "../models/ListRule";
import { DEFAULT_LIST_EVENT_TYPE } from "./SetDefaultBanListCommand";

interface Arguments {
    list: BanList;
    entity: string;
    reason: string;
}

// Exported for tests
export async function parseArguments(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]): Promise<Arguments> {
    let defaultShortcode = null;
    try {
        const data = await mjolnir.client.getAccountData(DEFAULT_LIST_EVENT_TYPE);
        defaultShortcode = data['shortcode'];
    } catch (e) {
        LogService.warn("KickUnkickCommand", "Non-fatal error getting default ban list");
        LogService.warn("KickUnkickCommand", e);

        // Assume no default.
    }

    let argumentIndex = 2;
    let entity = null;
    let list = null;
    while (argumentIndex < 6 && argumentIndex < parts.length) {
        const arg = parts[argumentIndex++];
        if (!arg) break;
        if (!entity && (arg[0] === '@' || arg.includes("*"))) {
            entity = arg;
        } else if (!list) {
            const foundList = mjolnir.lists.find(b => b.listShortcode.toLowerCase() === arg.toLowerCase());
            if (foundList) {
                list = foundList;
            }
        }

        if (entity) break;
    }

    if (!entity) {
        // Figure out which positional argument is the user id and where the reason starts.
        let userIndex = 2;
        if (list) userIndex++;
        entity = parts[userIndex];
        argumentIndex = userIndex + 1;
    }

    if (!list) {
        list = mjolnir.lists.find(b => b.listShortcode.toLowerCase() === defaultShortcode);
    }

    let replyMessage = null;
    if (!list) replyMessage = "No ban list matching that shortcode was found";
    else if (!entity) replyMessage = "No entity found";

    if (replyMessage) {
        const reply = RichReply.createFor(roomId, event, replyMessage, replyMessage);
        reply["msgtype"] = "m.notice";
        await mjolnir.client.sendMessage(roomId, reply);
        return null;
    }

    return {
        list,
        entity,
        reason: parts.splice(argumentIndex).join(" ").trim(),
    };
}

// !mjolnir addkick <shortcode> <glob> [reason]
export async function execKickCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    const bits = await parseArguments(roomId, event, mjolnir, parts);
    if (!bits) return; // error already handled

    const recommendation = recommendationToStable(RECOMMENDATION_KICK);
    const ruleContent = {
        entity: bits.entity,
        recommendation,
        reason: bits.reason,
    };
    const stateKey = `rule:${bits.entity}`;

    await mjolnir.client.sendStateEvent(bits.list.roomId, RULE_USER, stateKey, ruleContent);
    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
}

// !mjolnir removekick <shortcode> <glob>
export async function execUnkickCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    const bits = await parseArguments(roomId, event, mjolnir, parts);
    if (!bits) return; // error already handled

    const ruleContent = {}; // empty == clear/unkick
    const stateKey = `rule:${bits.entity}`;

    await mjolnir.client.sendStateEvent(bits.list.roomId, RULE_USER, stateKey, ruleContent);
    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
}
