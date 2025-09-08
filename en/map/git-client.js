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
    async checkAuthState() {
        if (window.netlifyIdentity) {
            const user = netlifyIdentity.currentUser();
            if (user) {
                await this.handleUserLogin(user);
                // Check Git Gateway config
                await this.checkGitGatewayConfig();
            }
        }
    }

    async initialize() {
        if (this.initialized) return; // avoid double binding
        if (!window.netlifyIdentity) {
            throw new Error('Netlify Identity not loaded');
        }
        await this.setupNetlifyIdentity();
        
        // Check if Git Gateway is configured
        await this.checkGitGatewayConfig();
    }
    
    /**
     * Check if Git Gateway is properly configured
     * This can help diagnose configuration issues
     */
    async checkGitGatewayConfig() {
        try {
            // Try to fetch Git Gateway health check
            const response = await fetch('/.netlify/git/settings', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Git Gateway config:', data);
            } else {
                console.warn('Git Gateway may not be properly configured:', 
                    response.status, response.statusText);
            }
        } catch (error) {
            console.warn('Could not check Git Gateway config:', error);
        }
    }

    setupNetlifyIdentity() {
        return new Promise((resolve) => {
            try {
                netlifyIdentity.on('init', async (user) => {
                    if (user) await this.handleUserLogin(user);
                    this.initialized = true;
                    resolve();
                });
                netlifyIdentity.on('login', async (user) => {
                    await this.handleUserLogin(user);
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

    async handleUserLogin(user) {
        this.user = user;
        
        // Ensure we have the latest token
        try {
            if (typeof user.jwt === 'function') {
                // Get a fresh token using the jwt() method
                const token = await user.jwt();
                this.token = token;
            } else {
                // Fall back to the access_token if jwt() method is not available
                this.token = user.token?.access_token;
            }
        } catch (e) {
            console.warn('Could not refresh token, using existing one:', e);
            this.token = user.token?.access_token;
        }
        
        this.isAuthenticated = true;
        
        // Log user info to help with debugging
        console.log('DM authenticated:', user.user_metadata?.full_name || user.email);
        console.log('Auth token details:', {
            tokenPresent: !!this.token,
            tokenLength: this.token?.length || 0,
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.full_name || 'not set',
            roles: user.app_metadata?.roles || []
        });

        // Dispatch a custom event so UI components can react to late auth resolution
        try {
            document.dispatchEvent(new CustomEvent('gitclient:login', { detail: { userEmail: user.email } }));
        } catch (e) {
            console.warn('Could not dispatch gitclient:login event', e);
        }
    }

    handleUserLogout() {
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        console.log('DM logged out');
        try {
            document.dispatchEvent(new CustomEvent('gitclient:logout'));
        } catch (e) {
            console.warn('Could not dispatch gitclient:logout event', e);
        }
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
                        await this.handleUserLogin(currentUser);
                        console.log('Token refreshed successfully');
                        
                        // Check Git Gateway config after refreshing token
                        await this.checkGitGatewayConfig();
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
            // Check if user is authenticated
            if (!this.isAuthenticated) {
                throw new Error('User not authenticated. Please login first.');
            }
            
            // Ensure we have a valid token
            if (!this.token || this.token.trim() === '') {
                // Try to refresh the token if possible
                try {
                    if (this.user && typeof this.user.jwt === 'function') {
                        console.log('Token missing or empty, attempting to refresh...');
                        this.token = await this.user.jwt();
                        console.log('Token refreshed successfully');
                    } else {
                        throw new Error('Cannot refresh authentication token');
                    }
                } catch (tokenError) {
                    console.error('Failed to refresh token:', tokenError);
                    throw new Error('Missing or invalid authentication token');
                }
            }
            
            // Log authentication state before proceeding
            console.log('Auth state before API call:', {
                isAuthenticated: this.isAuthenticated,
                hasUser: !!this.user,
                hasToken: !!this.token,
                tokenLength: this.token?.length || 0
            });
            
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
                sha: currentFile?.sha ? 'present' : 'missing',
                userId: this.user?.id || 'missing'
            });
            
            // Build URL with parameters to try to work around Netlify Git Gateway issues
            const url = new URL(`${window.location.origin}${this.baseURL}/contents/${filePath}`);
            url.searchParams.append('t', timestamp);
            
            // Attempt fix for "Operator microservice headers missing" by trying a different approach
            const headers = this.getAuthHeaders();
            
            const response = await fetch(url.toString(), {
                method: 'PUT',
                headers,
                body: JSON.stringify(updateData),
                credentials: 'include'  // Changed from 'same-origin' to 'include' for cross-site cookies
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
        
        // Include necessary headers for Netlify Git Gateway
        // Adding specific headers to solve "Operator microservice headers missing" error
        const userId = this.user?.id || '';
        const userEmail = this.user?.email || '';
        const userName = this.user?.user_metadata?.full_name || '';
        
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            // Add Netlify-specific headers that might be expected by the Git Gateway
            'X-Netlify-User': userId,
            'X-Netlify-User-Email': userEmail,
            'X-Netlify-User-Name': userName,
            'X-Git-Gateway': 'true',
            'X-Operator-Headers': 'true',
            'X-Netlify-Client': 'Nimea Map Editor'
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
            
            // Build URL with parameters to try to work around Netlify Git Gateway issues
            const url = new URL(`${window.location.origin}${this.baseURL}/contents/${filePath}`);
            url.searchParams.append('t', timestamp);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers,
                credentials: 'include'  // Changed to 'include' for cross-site cookies
            });

            if (response.status === 404) {
                return null; // File doesn't exist yet
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error fetching ${filePath}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    responseText: errorText
                });
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