/**
 * Git Gateway Client for Live CMS functionality
 * Integrates with Netlify Identity + Git Gateway to save map data directly to repository
 */

class GitGatewayClient {
    constructor() {
        this.baseURL = '/.netlify/git/github';
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
    }

    async initialize() {
        // Initialize Netlify Identity
        if (window.netlifyIdentity) {
            await this.setupNetlifyIdentity();
        } else {
            throw new Error('Netlify Identity not loaded');
        }
    }

    setupNetlifyIdentity() {
        return new Promise((resolve) => {
            netlifyIdentity.on('init', (user) => {
                if (user) {
                    this.handleUserLogin(user);
                }
                resolve();
            });

            netlifyIdentity.on('login', (user) => {
                this.handleUserLogin(user);
                netlifyIdentity.close();
            });

            netlifyIdentity.on('logout', () => {
                this.handleUserLogout();
            });

            netlifyIdentity.init();
        });
    }

    handleUserLogin(user) {
        this.user = user;
        this.token = user.token?.access_token;
        this.isAuthenticated = true;
        console.log('DM authenticated:', user.user_metadata?.full_name || user.email);
    }

    handleUserLogout() {
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        console.log('DM logged out');
    }

    async login() {
        if (!this.isAuthenticated) {
            netlifyIdentity.open();
        }
    }

    logout() {
        if (this.isAuthenticated) {
            netlifyIdentity.logout();
        }
    }

    async saveMarkersData(markersData) {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to save data');
        }

        const content = JSON.stringify(markersData, null, 2);
        const commitMessage = `Update markers.json from map editor

Updated by: ${this.user.user_metadata?.full_name || this.user.email}
Timestamp: ${new Date().toISOString()}`;

        return this.saveFileToRepo('data/markers.json', content, commitMessage);
    }

    async saveTerrainData(terrainData) {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to save data');
        }

        const content = JSON.stringify(terrainData, null, 2);
        const commitMessage = `Update terrain.geojson from map editor

Updated by: ${this.user.user_metadata?.full_name || this.user.email}
Timestamp: ${new Date().toISOString()}`;

        return this.saveFileToRepo('data/terrain.geojson', content, commitMessage);
    }

    async saveFileToRepo(filePath, content, commitMessage) {
        try {
            // First, get the current file to get its SHA (if it exists)
            const currentFile = await this.getFileFromRepo(filePath);
            
            // Prepare the file update
            const updateData = {
                message: commitMessage,
                content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
                branch: 'main'
            };

            if (currentFile && currentFile.sha) {
                updateData.sha = currentFile.sha; // Required for updating existing files
            }

            // Save file via Git Gateway
            const response = await fetch(`${this.baseURL}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to save ${filePath}: ${error}`);
            }

            const result = await response.json();
            console.log(`Successfully saved ${filePath} to repository`);
            return result;

        } catch (error) {
            console.error(`Error saving ${filePath}:`, error);
            throw error;
        }
    }

    async getFileFromRepo(filePath) {
        try {
            const response = await fetch(`${this.baseURL}/contents/${filePath}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 404) {
                return null; // File doesn't exist yet
            }

            if (!response.ok) {
                throw new Error(`Failed to get ${filePath}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn(`Could not fetch ${filePath}:`, error);
            return null;
        }
    }

    async triggerRedeploy() {
        // Trigger Netlify rebuild via webhook (if configured)
        // This ensures the site rebuilds with the new data
        try {
            const buildHookUrl = window.NETLIFY_BUILD_HOOK; // Set this in your config
            if (buildHookUrl) {
                await fetch(buildHookUrl, { method: 'POST' });
                console.log('Triggered site rebuild');
            }
        } catch (error) {
            console.warn('Could not trigger rebuild:', error);
        }
    }
}

// Global instance
window.gitClient = new GitGatewayClient();