"""
Authentication helper for Better Auth session-based authentication.
This module provides functions to authenticate with Better Auth and manage sessions.
"""
import requests
from typing import Optional, Dict


BASE_URL = "http://localhost:3000"
ADMIN_EMAIL = "hajzerbela@gmail.com"
ADMIN_PASSWORD = "bel2000BELLE$"
TIMEOUT = 30


class BetterAuthSession:
    """Manages Better Auth session cookies for authenticated requests."""
    
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.session = requests.Session()
        self._authenticated = False
    
    def authenticate(self) -> bool:
        """
        Authenticate with Better Auth and store session cookies.
        Returns True if authentication successful, False otherwise.
        """
        sign_in_url = f"{BASE_URL}/api/auth/sign-in/email"
        
        try:
            response = self.session.post(
                sign_in_url,
                json={
                    "email": self.email,
                    "password": self.password,
                },
                headers={
                    "Content-Type": "application/json",
                },
                timeout=TIMEOUT,
            )
            
            # Better Auth returns 200 on success
            if response.status_code == 200:
                self._authenticated = True
                # Session cookies are automatically stored in self.session.cookies
                return True
            else:
                print(f"Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """
        Get headers with session cookies for authenticated requests.
        Note: requests.Session automatically includes cookies, but we can add
        custom headers if needed.
        """
        headers = {
            "Content-Type": "application/json",
        }
        return headers
    
    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        Make an authenticated request using the session.
        Cookies are automatically included by requests.Session.
        """
        if not self._authenticated:
            if not self.authenticate():
                raise Exception("Authentication failed. Cannot make authenticated request.")
        
        # Set default headers if not provided
        # Only set Content-Type if there's actually a body (json or data)
        if "headers" not in kwargs:
            headers = {}
            # Only add Content-Type if request has a body
            if "json" in kwargs or "data" in kwargs:
                headers["Content-Type"] = "application/json"
            kwargs["headers"] = headers
        
        # Set timeout if not provided
        if "timeout" not in kwargs:
            kwargs["timeout"] = TIMEOUT
        
        return self.session.request(method, url, **kwargs)
    
    def get(self, url: str, **kwargs) -> requests.Response:
        """Make authenticated GET request."""
        return self.request("GET", url, **kwargs)
    
    def post(self, url: str, **kwargs) -> requests.Response:
        """Make authenticated POST request."""
        return self.request("POST", url, **kwargs)
    
    def put(self, url: str, **kwargs) -> requests.Response:
        """Make authenticated PUT request."""
        return self.request("PUT", url, **kwargs)
    
    def patch(self, url: str, **kwargs) -> requests.Response:
        """Make authenticated PATCH request."""
        return self.request("PATCH", url, **kwargs)
    
    def delete(self, url: str, **kwargs) -> requests.Response:
        """Make authenticated DELETE request."""
        return self.request("DELETE", url, **kwargs)


def get_admin_session() -> BetterAuthSession:
    """Get an authenticated admin session."""
    session = BetterAuthSession(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not session.authenticate():
        raise Exception(f"Failed to authenticate admin user: {ADMIN_EMAIL}")
    return session


def authenticate_and_get_session(email: str = ADMIN_EMAIL, password: str = ADMIN_PASSWORD) -> Optional[BetterAuthSession]:
    """
    Authenticate and return a BetterAuthSession instance.
    Returns None if authentication fails.
    """
    session = BetterAuthSession(email, password)
    if session.authenticate():
        return session
    return None

