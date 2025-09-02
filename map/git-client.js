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
        this.initialized = false; // track whether identity events have been bound
        
        // Force re-init when loaded to ensure we have the current auth state
        this.checkAuthState();
    }
    
    /**
     * Check the current auth state on load
     */
    checkAuthState() {
        if (window.netlifyIdentity) {
            const user = netlifyIdentity.currentUser();
            if (user) {
                this.handleUserLogin(user);
            }
        }
    }

    async initialize() {
        if (this.initialized) return; // avoid double binding
        if (!window.netlifyIdentity) {
            throw new Error('Netlify Identity not loaded');
        }
        await this.setupNetlifyIdentity();
    }

    setupNetlifyIdentity() {
        return new Promise((resolve) => {
            try {
                netlifyIdentity.on('init', (user) => {
                    if (user) this.handleUserLogin(user);
                    this.initialized = true;
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
            } catch (e) {
                console.error('Failed to set up Netlify Identity:', e);
                resolve();
            }
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
        if (!window.netlifyIdentity) {
            alert('Authentication not available: Netlify Identity script failed to load.');
            return;
        }
        
        // Always force initialization
        try {
            await this.initialize();
        } catch (e) {
            console.warn('Identity init failed on login attempt:', e);
        }
        
        if (!this.isAuthenticated) {
            try {
                // Check if we already have a user but token needs refreshing
                const currentUser = netlifyIdentity.currentUser();
                if (currentUser) {
                    console.log('User exists but needs refresh');
                    
                    // Try refreshing token
                    try {
                        await currentUser.jwt();
                        this.handleUserLogin(currentUser);
                        console.log('Token refreshed successfully');
                        return;
                    } catch (refreshError) {
                        console.warn('Failed to refresh token, will try login flow', refreshError);
                        netlifyIdentity.logout(); // Force logout to get a clean auth
                    }
                }
                
                // Show login dialog
                netlifyIdentity.open('login');
            } catch (e) {
                alert('Could not open login widget. See console for details.');
                console.error(e);
            }
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

        return this.saveFileToRepo('map/data/markers.json', content, commitMessage);
    }

    async saveTerrainData(terrainData) {
        if (!this.isAuthenticated) {
            throw new Error('Must be authenticated to save data');
        }

        const content = JSON.stringify(terrainData, null, 2);
        const commitMessage = `Update terrain.geojson from map editor

Updated by: ${this.user.user_metadata?.full_name || this.user.email}
Timestamp: ${new Date().toISOString()}`;

        return this.saveFileToRepo('map/data/terrain.geojson', content, commitMessage);
    }

    async saveFileToRepo(filePath, content, commitMessage) {
        try {
            // Ensure we have a valid token
            if (!this.token || this.token.trim() === '') {
                throw new Error('Missing authentication token');
            }
            
            // First, get the current file to get its SHA (if it exists)
            const currentFile = await this.getFileFromRepo(filePath);
            
            // Correctly encode content to Base64 to handle all characters
            const base64Content = await this.encodeContent(content);

            // Prepare the file update
            const updateData = {
                message: commitMessage,
                content: base64Content,
                branch: 'main'
            };

            if (currentFile && currentFile.sha) {
                updateData.sha = currentFile.sha; // Required for updating existing files
            }

            // Save file via Git Gateway
            // Add timestamp to prevent caching issues
            const timestamp = new Date().getTime();
            
            // Log what we're sending
            console.log(`Saving ${filePath} with data:`, {
                token: this.token ? 'present' : 'missing',
                hasContent: !!content,
                sha: currentFile?.sha ? 'present' : 'missing'
            });
            
            const response = await fetch(`${this.baseURL}/contents/${filePath}?t=${timestamp}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData),
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error response from server:`, {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                throw new Error(`Failed to save ${filePath}: ${errorText}`);
            }

            const result = await response.json();
            console.log(`Successfully saved ${filePath} to repository`);
            return result;

        } catch (error) {
            console.error(`Error saving ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Robustly encodes a string to Base64, handling Unicode characters.
     * @param {string} content The string content to encode.
     * @returns {Promise<string>} A promise that resolves with the Base64 encoded string.
     */
    encodeContent(content) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // result is a data URL, e.g., "data:application/json;base64,ey..."
                // We only need the part after the comma.
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
            const blob = new Blob([content], { type: 'application/json' });
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Helper method to get request headers for authenticated API calls
     */
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('Not authenticated');
        }
        
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    async getFileFromRepo(filePath) {
        try {
            // Ensure we have a valid token
            if (!this.token || this.token.trim() === '') {
                throw new Error('Missing authentication token');
            }
            
            // Adding timestamp to query string to attempt to bypass cache
            const timestamp = new Date().getTime();
            
            // Create fresh request with proper headers
            const headers = this.getAuthHeaders();
            delete headers['Content-Type']; // Not needed for GET requests
            
            const response = await fetch(`${this.baseURL}/contents/${filePath}?t=${timestamp}`, {
                method: 'GET',
                headers
            });

            if (response.status === 404) {
                return null; // File doesn't exist yet
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get ${filePath}: ${errorText}`);
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