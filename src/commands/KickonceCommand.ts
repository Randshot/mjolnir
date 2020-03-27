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
import { LogService, LogLevel, RichReply, MatrixGlob } from "matrix-bot-sdk";
import { logMessage } from "../LogProxy";
import config from "../config";

interface Arguments {
    entity: string;
    reason: string;
}

// Exported for tests
export async function parseArguments(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]): Promise<Arguments> {
    let argumentIndex = 2;
    let entity = null;

    while (argumentIndex < 6 && argumentIndex < parts.length) {
        const arg = parts[argumentIndex++];
        if (!arg) break;
        if (!entity && (arg[0] === '@' || arg.includes("*"))) {
            entity = arg;
        }

        if (entity) break;
    }

    if (!entity) {
        // Figure out which positional argument is the user id and where the reason starts.
        let userIndex = 2;
        entity = parts[userIndex];
        argumentIndex = userIndex + 1;
    }

    let replyMessage = null;
    if (!entity) replyMessage = "No entity found";

    if (replyMessage) {
        const reply = RichReply.createFor(roomId, event, replyMessage, replyMessage);
        reply["msgtype"] = "m.notice";
        await mjolnir.client.sendMessage(roomId, reply);
        return null;
    }

    return {
        entity,
        reason: parts.splice(argumentIndex).join(" ").trim(),
    };
}

// !mjolnir kickonce <glob> [reason]
export async function execKickonceCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    const bits = await parseArguments(roomId, event, mjolnir, parts);
    if (!bits) return; // error already handled

    const rule = new MatrixGlob(bits.entity);
    await logMessage(LogLevel.INFO, "KickonceCommand", "Kicking users that match glob: " + bits.entity);
    for (const protectedRoomId of Object.keys(mjolnir.protectedRooms)) {
        const memberIds = await mjolnir.client.getJoinedRoomMembers(protectedRoomId);
        const members = memberIds.map(u => {
            return {userId: u, membership: "join"};
        });

        await logMessage(LogLevel.DEBUG, "KickonceCommand", `Found ${members.length} joined user(s)`);
        let kicksApplied = 0;
        for (const member of members) {
            if (rule.test(member.userId)) {
                await logMessage(LogLevel.DEBUG, "KickonceCommand", `Kicking ${member.userId} in ${protectedRoomId}`);

                if (!config.noop) {
                    await mjolnir.client.kickUser(member.userId, protectedRoomId, bits.reason);
                } else {
                    await logMessage(LogLevel.WARN, "KickonceCommand", `Attempted to kick ${protectedRoomId} in ${protectedRoomId} but Mjolnir is running in no-op mode`);
                }

                kicksApplied++;
            }
        }

        if (kicksApplied > 0) {
            const html = `<font color="#00cc00"><b>Kicked ${kicksApplied} user(s)</b></font>`;
            const text = `Kicked ${kicksApplied} user(s)`;
            await mjolnir.client.sendMessage(config.managementRoom, {
                msgtype: "m.notice",
                body: text,
                format: "org.matrix.custom.html",
                formatted_body: html,
            });
        }
    }

    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
}
