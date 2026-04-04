#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

int calculate(int x, int y) {
    int sum = add(x, y);
    int product = multiply(x, y);
    return sum + product;
}

// 新增的除法函数
int divide(int a, int b) {
    if (b == 0) {
        return 0;
    }
    return a / b;
}

int main() {
    int result = calculate(5, 3);
    printf("Result: %d\n", result);

    // 测试新增的除法函数
    int div_result = divide(10, 2);
    printf("Division: %d\n", div_result);

    return 0;
}
