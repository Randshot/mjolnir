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

import { IProtection } from "./IProtection";
import { Mjolnir } from "../Mjolnir";
import { LogLevel, LogService } from "matrix-bot-sdk";
import { logMessage } from "../LogProxy";
import config from "../config";

export const SHORT_INTERVAL = 10000;
export const SHORT_MAX_PER_INTERVAL = 7; // if this is exceeded, we'll ban the user for spam and redact their messages
const TIMESTAMP_THRESHOLD = 5000; // 5s out of phase

const ROOM_MESSAGE = "m.room.message";

const ROOM_MESSAGE_TYPES = [ROOM_MESSAGE, "org.matrix.room.message"];
const ALL_EVENT_TYPES = [...ROOM_MESSAGE_TYPES];

export class ShortFlooding implements IProtection {

    private lastEvents: { [roomId: string]: { [userId: string]: { originServerTs: number, eventId: string }[] } } = {};
    //private recentlyBanned: string[] = [];

    constructor() {
    }

    public get name(): string {
        return 'ShortFloodingProtection';
    }

    public async handleEvent(mjolnir: Mjolnir, roomId: string, event: any): Promise<any> {
        if (!this.lastEvents[roomId]) this.lastEvents[roomId] = {};

        // Ignore non-message events
        if (!ALL_EVENT_TYPES.includes(event['type'])) return;

        // Ignore events sent by users in the management room
        const managers = await mjolnir.client.getJoinedRoomMembers(config.managementRoom);
        if (managers.includes(event['sender'])) return;

        const forRoom = this.lastEvents[roomId];
        if (!forRoom[event['sender']]) forRoom[event['sender']] = [];
        let forUser = forRoom[event['sender']];

        if ((new Date()).getTime() - event['origin_server_ts'] > TIMESTAMP_THRESHOLD) {
            LogService.warn("ShortFlooding", `${event['event_id']} is more than ${TIMESTAMP_THRESHOLD}ms out of phase - rewriting event time to be 'now'`);
            event['origin_server_ts'] = (new Date()).getTime();
        }

        forUser.push({originServerTs: event['origin_server_ts'], eventId: event['event_id']});

        // Do some math to see if the user is spamming
        let messageCount = 0;
        for (const prevEvent of forUser) {
            if ((new Date()).getTime() - prevEvent.originServerTs > SHORT_INTERVAL) continue; // not important
            messageCount++;
        }

        if (messageCount >= SHORT_MAX_PER_INTERVAL) {
            await logMessage(LogLevel.WARN, "ShortFlooding", `Kicking ${event['sender']} in ${roomId} for flooding (at least ${messageCount} messages in the last ${SHORT_INTERVAL * 0.001}s)`);
            if (!config.noop) {
                //await mjolnir.client.banUser(event['sender'], roomId, "spam");
                await mjolnir.client.kickUser(event['sender'], roomId, "[automated] spam");
            } else {
                await logMessage(LogLevel.WARN, "ShortFlooding", `Tried to kick ${event['sender']} in ${roomId} but Mjolnir is running in no-op mode`);
            }

            //if (this.recentlyBanned.includes(event['sender'])) return; // already handled (will be redacted)
            //mjolnir.redactionHandler.addUser(event['sender']);
            //this.recentlyBanned.push(event['sender']); // flag to reduce spam

            // Redact all the things the user said too
            if (!config.noop) {
                for (const eventId of forUser.map(e => e.eventId)) {
                    await mjolnir.client.redactEvent(roomId, eventId, "[automated] spam");
                }
            } else {
                await logMessage(LogLevel.WARN, "ShortFlooding", `Tried to redact messages for ${event['sender']} in ${roomId} but Mjolnir is running in no-op mode`);
            }

            // Free up some memory now that we're ready to handle it elsewhere
            forUser = forRoom[event['sender']] = []; // reset the user's list
        }

        // Trim the oldest messages off the user's history if it's getting large
        if (forUser.length > SHORT_MAX_PER_INTERVAL * 2) {
            forUser.splice(0, forUser.length - (SHORT_MAX_PER_INTERVAL * 2) - 1);
        }
    }
}
