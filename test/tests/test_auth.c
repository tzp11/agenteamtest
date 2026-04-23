#include <stdio.h>
#include <assert.h>
#include <string.h>

// Declare functions from auth.c
extern int validate_password(const char* password);
extern int user_exists(const char* username);
extern int authenticate_user(const char* username, const char* password);
extern char* generate_token(const char* username);
extern char* login(const char* username, const char* password);

// Constants for test data
const char* TEST_USERNAME = "admin";
const char* TEST_PASSWORD = "123456";
const char* TEST_INVALID_PASSWORD = "12345";
const char* TEST_NONEXISTENT_USER = "nonexistent";
const char* TEST_USER1 = "user1";

void test_validate_password() {
    // Test NULL password
    assert(validate_password(NULL) == 0);

    // Test empty string
    assert(validate_password("") == 0);

    // Test short password (below minimum length)
    assert(validate_password(TEST_INVALID_PASSWORD) == 0);

    // Test valid password (exactly minimum length)
    assert(validate_password(TEST_PASSWORD) == 1);

    // Test long password (above minimum length)
    assert(validate_password("1234567890") == 1);

    printf("✓ test_validate_password passed\n");
}

void test_user_exists() {
    // Test non-existent user
    assert(user_exists(TEST_NONEXISTENT_USER) == 0);

    // Test existing user
    assert(user_exists(TEST_USERNAME) == 1);

    // Test user1 exists
    assert(user_exists(TEST_USER1) == 1);

    printf("✓ test_user_exists passed\n");
}

void test_authenticate_user() {
    // Test NULL inputs
    assert(authenticate_user(NULL, NULL) == 0);
    assert(authenticate_user(TEST_USERNAME, NULL) == 0);
    assert(authenticate_user(NULL, TEST_PASSWORD) == 0);

    // Test non-existent user
    assert(authenticate_user(TEST_NONEXISTENT_USER, TEST_PASSWORD) == 0);

    // Test invalid password
    assert(authenticate_user(TEST_USERNAME, TEST_INVALID_PASSWORD) == 0);

    // Test successful authentication
    assert(authenticate_user(TEST_USERNAME, TEST_PASSWORD) == 1);

    // Test user1 authentication
    assert(authenticate_user(TEST_USER1, TEST_PASSWORD) == 1);

    printf("✓ test_authenticate_user passed\n");
}

void test_generate_token() {
    // Test token generation
    char* token = generate_token(TEST_USERNAME);
    assert(token != NULL);
    assert(strstr(token, TEST_USERNAME) != NULL);

    printf("✓ test_generate_token passed\n");
}

void test_login() {
    // Test NULL inputs
    assert(login(NULL, NULL) == NULL);
    assert(login(TEST_USERNAME, NULL) == NULL);
    assert(login(NULL, TEST_PASSWORD) == NULL);

    // Test failed login (non-existent user)
    assert(login(TEST_NONEXISTENT_USER, TEST_PASSWORD) == NULL);

    // Test failed login (invalid password)
    assert(login(TEST_USERNAME, TEST_INVALID_PASSWORD) == NULL);

    // Test successful login
    char* token = login(TEST_USERNAME, TEST_PASSWORD);
    assert(token != NULL);
    assert(strstr(token, TEST_USERNAME) != NULL);

    // Test user1 login
    char* token1 = login(TEST_USER1, TEST_PASSWORD);
    assert(token1 != NULL);
    assert(strstr(token1, TEST_USER1) != NULL);

    printf("✓ test_login passed\n");
}

int main() {
    printf("Running tests...\n\n");
    test_validate_password();
    test_user_exists();
    test_authenticate_user();
    test_generate_token();
    test_login();
    printf("\nAll tests passed!\n");
    return 0;
}