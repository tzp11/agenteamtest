// Test file for authentication
#include <stdio.h>
#include <assert.h>
#include <string.h>

// External functions from auth.c
extern int authenticate_user(const char* username, const char* password);
extern char* generate_token(const char* username);
extern char* login(const char* username, const char* password);

void test_authenticate_user_success() {
    int result = authenticate_user("admin", "password123");
    assert(result == 1);
    printf("✓ test_authenticate_user_success passed\n");
}

void test_authenticate_user_invalid_password() {
    int result = authenticate_user("admin", "123");
    assert(result == 0);
    printf("✓ test_authenticate_user_invalid_password passed\n");
}

void test_authenticate_user_user_not_found() {
    int result = authenticate_user("unknown", "password123");
    assert(result == 0);
    printf("✓ test_authenticate_user_user_not_found passed\n");
}

void test_generate_token() {
    char* token = generate_token("admin");
    assert(token != NULL);
    assert(strncmp(token, "TOKEN_admin", 11) == 0);
    printf("✓ test_generate_token passed\n");
}

void test_login_success() {
    char* token = login("admin", "password123");
    assert(token != NULL);
    printf("✓ test_login_success passed\n");
}

void test_login_failure() {
    char* token = login("admin", "wrong");
    assert(token == NULL);
    printf("✓ test_login_failure passed\n");
}

int main() {
    printf("Running authentication tests...\n\n");

    test_authenticate_user_success();
    test_authenticate_user_invalid_password();
    test_authenticate_user_user_not_found();
    test_generate_token();
    test_login_success();
    test_login_failure();

    printf("\nAll tests passed!\n");
    return 0;
}
