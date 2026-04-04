// Authentication module
#include <stdio.h>
#include <string.h>

// Helper function to validate password
int validate_password(const char* password) {
    if (password == NULL) {
        return 0;
    }
    if (strlen(password) < 6) {
        return 0;
    }
    return 1;
}

// Helper function to check user exists
int user_exists(const char* username) {
    // Simulate database lookup
    if (strcmp(username, "admin") == 0) {
        return 1;
    }
    if (strcmp(username, "user1") == 0) {
        return 1;
    }
    return 0;
}

// Main authentication function
int authenticate_user(const char* username, const char* password) {
    if (username == NULL || password == NULL) {
        return 0;
    }

    if (!user_exists(username)) {
        printf("User not found: %s\n", username);
        return 0;
    }

    if (!validate_password(password)) {
        printf("Invalid password\n");
        return 0;
    }

    printf("Authentication successful for user: %s\n", username);
    return 1;
}

// Generate session token
char* generate_token(const char* username) {
    static char token[64];
    snprintf(token, sizeof(token), "TOKEN_%s_12345", username);
    return token;
}

// Login function (calls authenticate_user and generate_token)
char* login(const char* username, const char* password) {
    if (authenticate_user(username, password)) {
        return generate_token(username);
    }
    return NULL;
}
