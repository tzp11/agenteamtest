// Test file for session management
#include <stdio.h>
#include <assert.h>
#include <string.h>

// External functions from session.c
extern int validate_session(const char* token);
extern int is_session_expired(const char* token, int timeout_seconds);
extern char* refresh_token(const char* old_token);
extern void logout(const char* token);

void test_validate_session_success() {
    int result = validate_session("TOKEN_admin_12345");
    assert(result == 1);
    printf("✓ test_validate_session_success passed\n");
}

void test_validate_session_invalid_format() {
    int result = validate_session("INVALID_TOKEN");
    assert(result == 0);
    printf("✓ test_validate_session_invalid_format passed\n");
}

void test_refresh_token() {
    char* new_token = refresh_token("TOKEN_admin_12345");
    assert(new_token != NULL);
    assert(strstr(new_token, "REFRESHED") != NULL);
    printf("✓ test_refresh_token passed\n");
}

void test_logout() {
    logout("TOKEN_admin_12345");
    printf("✓ test_logout passed\n");
}

int main() {
    printf("Running session tests...\n\n");

    test_validate_session_success();
    test_validate_session_invalid_format();
    test_refresh_token();
    test_logout();

    printf("\nAll tests passed!\n");
    return 0;
}
