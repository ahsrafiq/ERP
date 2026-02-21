import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export type AppMode = 'MASTER' | 'CLIENT';

export interface AppConfig {
    mode: AppMode;
    serverIp: string;
    serverPort: number;
}

const defaultConfig: AppConfig = {
    mode: 'MASTER',
    serverIp: '127.0.0.1',
    serverPort: 3000,
};

const configPath = path.join(app.getPath('userData'), 'config.json');

export function getConfig(): AppConfig {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return { ...defaultConfig, ...JSON.parse(data) };
        }
    } catch (error) {
        console.error('Error reading config:', error);
    }
    return defaultConfig;
}

export function saveConfig(config: AppConfig): void {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

export function isMasterMode(): boolean {
    return getConfig().mode === 'MASTER';
}
