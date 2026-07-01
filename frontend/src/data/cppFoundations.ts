export interface MCQ {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface CodeExercise {
  instruction: string;
  templateCode: string;
  solutionCode: string;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string[]; // List of HTML or markdown strings
  mcq?: MCQ;
  codeExercise?: CodeExercise;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface PlacementQuestion {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  answerLabel: string; // e.g. "C"
  explanation: string;
}

export const cppFoundationsChapters: Chapter[] = [
  {
    id: 'ch1',
    title: 'Chapter 1 — How C++ Programs Run',
    lessons: [
      {
        id: '1.1',
        title: 'Lesson 1.1 — From source code to executable',
        content: [
          'Most people write C++ and just hit run. But here\'s the thing — there\'s a lot happening between your <code>.cpp</code> file and a running program. And when something goes wrong, which it will, you need to know which stage broke and why.',
          'There are three stages: <strong>preprocessing</strong>, <strong>compilation</strong>, and <strong>linking</strong>.',
          '<strong>Preprocessing</strong> happens first. The preprocessor is basically a text-substitution tool. It runs through your code before the compiler sees it, handles all the <code>#include</code> directives by literally copy-pasting the contents of those header files into your file, and expands any <code>#define</code> macros. The output is one big translation unit — just plain C++ text, no directives left.',
          '<strong>Compilation</strong> takes that translation unit and turns it into machine code — specifically an object file (<code>.o</code> or <code>.obj</code>). This is where your syntax errors show up. The compiler checks your code against the C++ language rules and produces binary output if everything checks out. One <code>.cpp</code> file produces one object file.',
          '<strong>Linking</strong> is the final step. Your program probably uses functions from multiple files — your own code, the standard library, maybe third-party libraries. The linker takes all the object files and stitches them together into one executable. This is where you get "undefined reference" errors — when the linker can\'t find the implementation of something you declared.'
        ],
        mcq: {
          question: 'You get an "undefined reference to foo()" error. Which stage is this coming from?',
          options: [
            'A. Preprocessor',
            'B. Compiler',
            'C. Linker',
            'D. Runtime'
          ],
          answerIndex: 2,
          explanation: 'The compiler already verified that foo was declared somewhere — that\'s enough for it to produce the object file. The linker is the one that tries to find the actual implementation and fails when it can\'t.'
        }
      },
      {
        id: '1.2',
        title: 'Lesson 1.2 — The main function and program execution',
        content: [
          'Every C++ program starts at <code>main</code>. Not at the top of your file, not at the first function you defined — at <code>main</code>. The OS loads your executable and calls <code>main()</code> first. Everything flows from there.',
          'There are two valid signatures for <code>main</code>:',
          '<pre><code>int main()                          // no command-line arguments\nint main(int argc, char* argv[])    // with command-line arguments</code></pre>',
          '<code>main</code> returns an <code>int</code>. Returning <code>0</code> means the program exited successfully. Returning anything else signals an error to the OS. In practice you\'ll almost always <code>return 0</code>, but this is why it\'s there.',
          'One thing worth knowing: if you don\'t write a <code>return</code> statement in <code>main</code>, C++ implicitly returns <code>0</code> for you. That\'s a special case — no other function gets this treatment.'
        ],
        mcq: {
          question: 'What happens if you return 1 from main()?',
          options: [
            'A. The program crashes',
            'B. The program runs again from the beginning',
            'C. The OS receives a non-zero exit code indicating an error',
            'D. The compiler rejects it'
          ],
          answerIndex: 2,
          explanation: 'Returning a non-zero value from main is a convention for signalling failure to the OS or to whatever script called your program. The program still terminates normally — it doesn\'t crash.'
        }
      },
      {
        id: '1.3',
        title: 'Lesson 1.3 — Header files and the #include system',
        content: [
          'When you write <code>#include &lt;iostream&gt;</code>, you\'re not importing a module the way Python does. You\'re telling the preprocessor to literally paste the contents of the <code>iostream</code> header file into your code before compilation begins.',
          'This is why you can get thousands of lines of compiler output for a three-line program — the headers you include are enormous.',
          'There are two forms:',
          '<pre><code>#include &lt;iostream&gt;   // angle brackets — looks in system include paths\n#include "myfile.h"   // quotes — looks in current directory first</code></pre>',
          'Header files typically contain declarations — they tell the compiler that a function or class exists and what its signature is, without providing the implementation. The implementation lives in a <code>.cpp</code> file. The linker\'s job is to connect the two.',
          'This separation is why you can include <code>&lt;vector&gt;</code> and use <code>std::vector</code> without the compiler needing to see the entire vector implementation. The header declares it, the compiled standard library provides the implementation, and the linker connects them.'
        ],
        mcq: {
          question: 'You write a function void foo() in helpers.cpp and declare it in helpers.h. In main.cpp you #include "helpers.h" and call foo(). What does the preprocessor do with the #include?',
          options: [
            'A. It compiles helpers.cpp first',
            'B. It copies the contents of helpers.h into main.cpp before compilation',
            'C. It links helpers.o into the final executable',
            'D. It checks that foo() has a matching implementation'
          ],
          answerIndex: 1,
          explanation: 'The preprocessor is a text tool. It finds helpers.h and pastes its contents directly into main.cpp. The compiler then sees the declaration of foo. Finding the implementation is the linker\'s job, not the preprocessor\'s.'
        }
      }
    ]
  },
  {
    id: 'ch2',
    title: 'Chapter 2 — Types, Variables, and Memory',
    lessons: [
      {
        id: '2.1',
        title: 'Lesson 2.1 — How types map to bytes',
        content: [
          'Every variable in C++ takes up a certain number of bytes in memory. The type tells the compiler how many bytes to reserve and how to interpret those bytes.',
          'Here are the ones you\'ll use constantly in DSA:',
          '<ul><li><code>bool</code> — 1 byte — true or false</li><li><code>char</code> — 1 byte — a single character or small integer</li><li><code>int</code> — 4 bytes — most problems use this for integers</li><li><code>long long</code> — 8 bytes — when int isn\'t big enough (up to ~9.2 × 10^18)</li><li><code>float</code> — 4 bytes — floating point, avoid in DSA</li><li><code>double</code> — 8 bytes — more precise float, still avoid unless needed</li></ul>',
          '<code>sizeof</code> gives you the exact byte count on your system:',
          '<pre><code>std::cout &lt;&lt; sizeof(int)       &lt;&lt; "\\n";   // 4\nstd::cout &lt;&lt; sizeof(long long) &lt;&lt; "\\n";   // 8\nstd::cout &lt;&lt; sizeof(char)      &lt;&lt; "\\n";   // 1</code></pre>',
          'In competitive programming and DSA, you\'ll almost always use <code>int</code> for indices and values, and reach for <code>long long</code> when values can exceed ~2 billion (2^31 - 1 = 2,147,483,647). Getting this wrong causes silent integer overflow — your code runs but gives wrong answers, which is one of the most frustrating bugs to track down.'
        ],
        mcq: {
          question: 'A problem says array values can be up to 10^9 and you\'re summing all of them. The array has up to 10^5 elements. What type should you use for the sum variable?',
          options: [
            'A. int — 10^9 fits in an int',
            'B. long long — the sum can reach 10^14 which overflows int',
            'C. double — it can hold large numbers',
            'D. float — same as double but faster'
          ],
          answerIndex: 1,
          explanation: 'Each element can be up to 10^9. With 10^5 elements, the sum can reach 10^14. int maxes out at ~2.1 × 10^9. long long holds up to ~9.2 × 10^18 so you\'re safe. Never use double for integer sums — floating point precision errors will bite you.'
        }
      },
      {
        id: '2.2',
        title: 'Lesson 2.2 — Signed vs unsigned and integer overflow',
        content: [
          'By default, integer types in C++ are signed — they can hold negative values. An <code>int</code> uses 32 bits, with one bit reserved for the sign. That gives you a range of -2,147,483,648 to 2,147,483,647.',
          '<code>unsigned int</code> uses all 32 bits for the magnitude. Range: 0 to 4,294,967,295. Sounds useful but in practice you should almost never use <code>unsigned</code> in DSA. Here\'s why:',
          '<pre><code>unsigned int a = 0;\nunsigned int b = 1;\nstd::cout &lt;&lt; a - b;   // not -1. prints 4294967295.</code></pre>',
          'Unsigned types wrap around on underflow. <code>0 - 1</code> becomes the largest possible unsigned value. This is defined behaviour in C++ but it will destroy your logic if you\'re not expecting it. Stick to <code>int</code> and <code>long long</code>.',
          'Integer overflow on signed types is actually undefined behaviour in C++ — the compiler is allowed to do anything, including produce wrong answers silently or optimise your code in ways that assume overflow never happens. So when values might get large, switch to <code>long long</code> early.'
        ],
        mcq: {
          question: 'int x = INT_MAX; x++; — what happens?',
          options: [
            'A. x wraps around to INT_MIN reliably',
            'B. The program throws a runtime exception',
            'C. This is undefined behaviour — the compiler can do anything',
            'D. The compiler rejects it'
          ],
          answerIndex: 2,
          explanation: 'Signed integer overflow is undefined behaviour in C++. The compiler is not required to wrap around. In practice many compilers do, but you cannot rely on it. The correct fix is to use long long.'
        }
      },
      {
        id: '2.3',
        title: 'Lesson 2.3 — Type casting',
        content: [
          'Sometimes you need to convert a value from one type to another. C++ gives you several ways to do this, and they\'re not all equivalent.',
          'The C-style cast — <code>(int)x</code> — works but it\'s blunt. It\'ll do whatever conversion is needed without telling you if it\'s dangerous. In modern C++ you should prefer named casts because they\'re explicit about what kind of conversion you intend.',
          'For DSA, you\'ll mainly use <code>static_cast</code>:',
          '<pre><code>double ratio = static_cast&lt;double&gt;(a) / b;   // integer division avoided\nint truncated = static_cast&lt;int&gt;(3.9);        // gives 3, truncates toward zero</code></pre>',
          'The most common mistake in DSA is accidentally doing integer division when you meant floating point division:',
          '<pre><code>int a = 7, b = 2;\ndouble wrong = a / b;          // 3.0 — integer division happens first\ndouble right = (double)a / b;  // 3.5 — a is cast before the division</code></pre>',
          'The division happens before the assignment. By the time you assign to <code>double</code>, the integer division has already discarded the remainder. Cast before the operation.'
        ],
        codeExercise: {
          instruction: 'Fix the average function so it returns the correct floating-point average. Keep operator precedence and floating point casting in mind.',
          templateCode: `// Returns the average of two integers
// Bug: currently returns wrong answer for odd sums
double average(int a, int b) {
    return a + b / 2;   // two bugs here — find and fix both
}

int main() {
    std::cout << average(7, 3) << "\\n";   // should print 5.0
    std::cout << average(1, 2) << "\\n";   // should print 1.5
}`,
          solutionCode: `double average(int a, int b) {
    return static_cast<double>(a + b) / 2.0;   // Correct: cast sum and divide by double
}`,
          explanation: 'First, add parentheses around (a + b) because division `/` has higher operator precedence than addition `+`. Second, cast the sum to a `double` using static_cast (or divide by `2.0` instead of `2`) to trigger floating point division instead of integer truncation.'
        }
      }
    ]
  },
  {
    id: 'ch3',
    title: 'Chapter 3 — Pointers and References',
    lessons: [
      {
        id: '3.1',
        title: 'Lesson 3.1 — What a pointer actually is',
        content: [
          'Let\'s be very direct about this: a pointer is a variable that holds a memory address. That\'s it. There\'s nothing magic about it.',
          'When you declare <code>int x = 42</code>, the value <code>42</code> is stored at some address in memory — say <code>0x1000</code>. A pointer to <code>x</code> is just another variable that stores the value <code>0x1000</code>. It points to where <code>x</code> lives.',
          '<pre><code>int x = 42;\nint* p = &x;    // & is "address-of" operator\n\nstd::cout &lt;&lt; x;    // 42       — the value\nstd::cout &lt;&lt; &x;   // 0x1000   — address of x\nstd::cout &lt;&lt; p;    // 0x1000   — p holds address\nstd::cout &lt;&lt; *p;   // 42       — * dereferences: reads value at address</code></pre>',
          'The <code>*</code> operator has two jobs in C++ and this trips everyone up. In a declaration — <code>int* p</code> — the <code>*</code> means "this is a pointer type". Everywhere else — <code>*p</code> — it means "go to the address stored in p and give me the value there". These are two completely different uses of the same symbol.'
        ],
        mcq: {
          question: 'Given: int x = 10; int* p = &x; *p = 20; — what is the value of x after this runs?',
          options: [
            'A. 10 — p is a copy, changing it doesn\'t affect x',
            'B. 20 — *p dereferences to x\'s address and writes 20 there',
            'C. The address of x',
            'D. Undefined — you can\'t assign through a pointer like this'
          ],
          answerIndex: 1,
          explanation: '*p = 20 dereferences p — it goes to the address that p holds (which is x\'s address) and writes 20 there. x and *p refer to the same memory location.'
        }
      },
      {
        id: '3.2',
        title: 'Lesson 3.2 — Pointer arithmetic',
        content: [
          'Because pointers hold addresses, you can do arithmetic on them. And this is exactly how array indexing works under the hood.',
          'When you add 1 to a pointer, you don\'t add 1 byte — you add <code>sizeof(T)</code> bytes, where T is the type the pointer points to. So adding 1 to an <code>int*</code> advances it by 4 bytes, landing you at the next integer.',
          '<pre><code>int arr[5] = {10, 20, 30, 40, 50};\nint* p = arr;   // p points to arr[0]\n\nstd::cout &lt;&lt; *p;       // 10\nstd::cout &lt;&lt; *(p+1);   // 20 — advanced by sizeof(int) = 4 bytes\nstd::cout &lt;&lt; *(p+2);   // 30\n\n// arr[i] and *(arr+i) are identical\nstd::cout &lt;&lt; arr[3];       // 40\nstd::cout &lt;&lt; *(arr + 3);   // 40</code></pre>',
          'This is why array access is O(1). There\'s no searching involved — just one address computation.'
        ],
        codeExercise: {
          instruction: 'Use pointer arithmetic (no bracket notation) to print all elements of an array.',
          templateCode: `#include <iostream>
using namespace std;

void print_array(int* arr, int size) {
    // TODO: print each element using *(arr + i) syntax
    // Do NOT use arr[i]
}

int main() {
    int arr[5] = {10, 20, 30, 40, 50};
    print_array(arr, 5);
    // Expected: 10 20 30 40 50
}`,
          solutionCode: `void print_array(int* arr, int size) {
    for (int i = 0; i < size; i++) {
        cout << *(arr + i) << (i == size - 1 ? "" : " ");
    }
}`,
          explanation: '`*(arr + i)` accesses the element at offset `i` from the base array address by multiplying `i` by the size of an int.'
        }
      },
      {
        id: '3.3',
        title: 'Lesson 3.3 — References',
        content: [
          'A reference is an alias. When you create a reference to a variable, you\'re giving that same variable a second name. There\'s no new memory allocated — both the original variable and the reference point to the exact same location.',
          '<pre><code>int x = 42;\nint& ref = x;   // ref is an alias for x\n\nref = 99;\nstd::cout &lt;&lt; x;   // 99 — x changed because ref IS x</code></pre>',
          'References look and behave like regular variables, but they\'re secretly just another name for something that already exists. Two key rules: a reference must be initialised when declared (you can\'t have a reference to nothing), and once a reference is bound to a variable it can never be rebound to a different variable.',
          'This is different from pointers, which can be null, can be reassigned, and need <code>*</code> to dereference. References are simpler and safer for most use cases.'
        ],
        mcq: {
          question: 'What is the key difference between a pointer and a reference in C++?',
          options: [
            'A. Pointers can only hold integers, references can hold any type',
            'B. A reference must be initialised and cannot be rebound; a pointer can be null and reassigned',
            'C. References use more memory than pointers',
            'D. Pointers are faster than references at runtime'
          ],
          answerIndex: 1,
          explanation: 'The fundamental difference is that a reference is always bound to something (no null references) and that binding is permanent. A pointer can be null, can be reassigned, and requires explicit dereferencing.'
        }
      },
      {
        id: '3.4',
        title: 'Lesson 3.4 — Pass by value vs pass by reference',
        content: [
          'This is one of the most important things to understand before you write a single DSA function. When you pass a variable to a function, C++ copies it by default — that\'s pass by value. The function gets its own copy. Changes inside the function don\'t affect the original.',
          '<pre><code>void double_it(int x) {\n    x = x * 2;   // only local copy changes\n}</code></pre>',
          'To actually modify the original, pass by reference:',
          '<pre><code>void double_it(int& x) {   // & makes it a reference\n    x = x * 2;             // modifies original\n}</code></pre>',
          'In DSA you\'ll also see <code>const</code> references — pass by reference for efficiency (no copy) but <code>const</code> to prevent modification:',
          '<pre><code>void print_vec(const std::vector&lt;int&gt;& v) {\n    for (int x : v) std::cout &lt;&lt; x &lt;&lt; " ";\n}</code></pre>',
          'Passing a vector by value copies the entire vector. Passing by <code>const&amp;</code> avoids the copy. For anything larger than a primitive type, <code>const&amp;</code> is almost always the right choice when you don\'t need to modify the argument.'
        ],
        codeExercise: {
          instruction: 'Fix the swap function so it actually swaps the two values.',
          templateCode: `#include <iostream>
using namespace std;

void swap(int a, int b) {   // bug is here
    int temp = a;
    a = b;
    b = temp;
}

int main() {
    int x = 5, y = 10;
    swap(x, y);
    cout << x << " " << y << "\\n";   // should print: 10 5
}`,
          solutionCode: `void swap(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}`,
          explanation: 'By adding `&` to parameters `a` and `b` (`int& a, int& b`), they are passed by reference, meaning the changes swap the original variables passed in `main` (`x` and `y`).'
        }
      }
    ]
  },
  {
    id: 'ch4',
    title: 'Chapter 4 — Stack and Heap',
    lessons: [
      {
        id: '4.1',
        title: 'Lesson 4.1 — The call stack',
        content: [
          'Every time you call a function, C++ creates a stack frame for it — a block of memory that holds the function\'s local variables, its parameters, and the return address (where to go when the function finishes). These frames stack on top of each other, and when a function returns, its frame is popped off.',
          'This is the call stack. It\'s fast because allocating a frame is just moving one pointer. It\'s automatic because frames are cleaned up the moment a function returns. And it has a fixed size — typically around 1-8MB depending on the OS.',
          '<pre><code>void c() { int z = 3; }\nvoid b() { int y = 2; c(); }\nint main() { int x = 1; b(); }</code></pre>',
          'Stack overflow happens when you push too many frames — usually from infinite or very deep recursion. The stack runs out of space. C++ has no way to recover from this; the program crashes.'
        ],
        mcq: {
          question: 'A recursive function calls itself 1,000,000 times before hitting the base case. What is most likely to happen?',
          options: [
            'A. The program runs slowly but correctly',
            'B. The program stack overflows and crashes',
            'C. The compiler optimises it into a loop automatically',
            'D. The heap runs out of memory'
          ],
          answerIndex: 1,
          explanation: 'Each recursive call pushes a new stack frame. With 1,000,000 frames and a typical stack size of 1-8MB, you\'ll almost certainly overflow the stack.'
        }
      },
      {
        id: '4.2',
        title: 'Lesson 4.2 — The heap and dynamic allocation',
        content: [
          'The heap is the other region of memory your program can use. Unlike the stack, it doesn\'t have a fixed size limit (it can grow up to your system\'s available RAM), and memory on it persists until you explicitly free it.',
          'You allocate on the heap with <code>new</code> and free with <code>delete</code> or <code>delete[]</code>:',
          '<pre><code>// Allocate a single int on the heap\nint* p = new int(42);\ndelete p;          // free it\n\n// Allocate an array on the heap\nint* arr = new int[100];\ndelete[] arr;      // note delete[] for arrays</code></pre>',
          'The key rules:',
          '<ul><li>Every <code>new</code> must have exactly one matching <code>delete</code> (or <code>delete[]</code>)</li><li>Forgetting to delete is a memory leak — memory stays allocated</li><li>Deleting the same pointer twice is undefined behaviour (double free)</li><li>Accessing memory after deleting it is undefined behaviour (use-after-free)</li></ul>',
          'In modern C++ you\'d use smart pointers (<code>unique_ptr</code>, <code>shared_ptr</code>) to handle this automatically. For DSA purposes, you\'ll mostly use <code>std::vector</code> which handles heap allocation for you.'
        ],
        codeExercise: {
          instruction: 'Fix the memory leak in this function.',
          templateCode: `#include <iostream>
using namespace std;

void process() {
    int* data = new int[50];
    for (int i = 0; i < 50; i++) data[i] = i * 2;
    std::cout << data[25] << "\\n";
    // memory is never freed — fix this
}

int main() {
    process();
}`,
          solutionCode: `void process() {
    int* data = new int[50];
    for (int i = 0; i < 50; i++) data[i] = i * 2;
    std::cout << data[25] << "\\n";
    delete[] data; // Correct: free the dynamic array
}`,
          explanation: 'Since `data` is allocated using `new int[50]`, it must be freed with `delete[] data` to prevent a memory leak before the function returns and loses the pointer variable.'
        }
      },
      {
        id: '4.3',
        title: 'Lesson 4.3 — Stack vs heap — when to use which',
        content: [
          'Now that you know both exist, here\'s the practical decision:',
          '<strong>Use the stack when:</strong>',
          '<ul><li>The size is known at compile time</li><li>The lifetime matches the function\'s lifetime</li><li>The data is small (a few variables, a small fixed-size array)</li></ul>',
          '<strong>Use the heap when:</strong>',
          '<ul><li>The size is determined at runtime</li><li>The data needs to outlive the function that created it</li><li>You\'re allocating large data structures</li></ul>',
          '<pre><code>// Heap necessary when size is runtime-determined\nint n;\ncin &gt;&gt; n;\nint* arr = new int[n];   // heap allocation</code></pre>',
          'The golden rule for DSA in C++: use <code>std::vector</code> instead of raw heap arrays. It gives you dynamic sizing, automatic memory management, and the same O(1) access. Raw <code>new</code>/<code>delete</code> is for when you\'re implementing a data structure from scratch — like you will in Unit 1.'
        ],
        mcq: {
          question: 'Which of the following requires heap allocation?',
          options: [
            'A. int arr[100] inside a function',
            'B. A vector whose size is read from user input at runtime',
            'C. A local int variable inside a loop',
            'D. A function parameter of type int'
          ],
          answerIndex: 1,
          explanation: 'The size is not known until runtime, so the compiler cannot reserve stack space. `std::vector` handles this internally by allocating on the heap.'
        }
      }
    ]
  },
  {
    id: 'ch5',
    title: 'Chapter 5 — Functions in Depth',
    lessons: [
      {
        id: '5.1',
        title: 'Lesson 5.1 — const correctness',
        content: [
          '<code>const</code> is one of those things that looks optional until it saves you from a bug at 2am. It tells the compiler "this value should not change" — and the compiler enforces it.',
          '<pre><code>const int MAX = 1000;\nMAX = 2000;   // compiler error\n\nconst int* p = &x;   // pointer to const int — can\'t change *p\nint* const p2 = &x;  // const pointer — can\'t change address p2 holds</code></pre>',
          'In DSA the most common place you\'ll see <code>const</code> is in function parameters:',
          '<pre><code>void print(const std::vector&lt;int&gt;& v); // promised not to modify v</code></pre>',
          'Always add <code>const</code> to reference parameters when you don\'t intend to modify the argument. It communicates intent, prevents accidental bugs, and allows the compiler to pass temporary values and literals to your function.'
        ],
        mcq: {
          question: 'A function takes const std::vector<int>& v. Inside the function, you try to call v.push_back(5). What happens?',
          options: [
            'A. It works — push_back ignores const',
            'B. It silently does nothing',
            'C. Compiler error — you promised not to modify v',
            'D. Runtime error'
          ],
          answerIndex: 2,
          explanation: 'const is a compile-time guarantee. push_back is a non-const method that modifies the vector. The compiler will reject this call.'
        }
      },
      {
        id: '5.2',
        title: 'Lesson 5.2 — Function overloading and default arguments',
        content: [
          'C++ lets you define multiple functions with the same name as long as their parameter lists differ. The compiler picks the right one based on the arguments you pass.',
          '<pre><code>int add(int a, int b)       { return a + b; }\ndouble add(double a, double b) { return a + b; }</code></pre>',
          'Default arguments let callers omit trailing parameters:',
          '<pre><code>void print_array(int* arr, int size, bool newline = true) {\n    for (int i = 0; i &lt; size; i++) std::cout &lt;&lt; arr[i] &lt;&lt; " ";\n    if (newline) std::cout &lt;&lt; "\\n";\n}</code></pre>',
          'One rule: default arguments must come at the end of the parameter list. You can\'t have a default argument followed by a non-default one.'
        ],
        mcq: {
          question: 'You declare void foo(int a = 1, int b, int c = 3). What\'s wrong?',
          options: [
            'A. Nothing — all three can have defaults',
            'B. b has no default but c after it does — compiler error',
            'C. You can only have one default argument per function',
            'D. Default arguments aren\'t allowed in C++17'
          ],
          answerIndex: 1,
          explanation: 'Default arguments must be at the end. Once you start giving defaults, all remaining parameters must also have defaults. Parameter `b` violates this.'
        }
      },
      {
        id: '5.3',
        title: 'Lesson 5.3 — Returning from functions safely',
        content: [
          'Returning a local variable by value is fine — C++ copies it out before destroying the stack frame. But returning a reference or pointer to a local variable is a disaster:',
          '<pre><code>// FINE — value is copied out\nint get_value() { int x = 42; return x; }\n\n// DISASTER — dangling reference\nint& get_reference() { int x = 42; return x; }</code></pre>',
          'The second function returns a reference to a local variable that no longer exists. The caller\'s reference is now dangling — it points to memory that\'s been reclaimed by the stack. Using it is undefined behaviour.',
          'In DSA you\'ll sometimes want to return large objects efficiently. In modern C++ (and C++17 especially), return by value is almost always fine due to Return Value Optimisation (RVO) — the compiler constructs the return value directly in the caller\'s memory without copying. So don\'t tie yourself in knots trying to return references to avoid copies.'
        ],
        mcq: {
          question: 'Which of the following is safe to return by reference?',
          options: [
            'A. A local int variable declared inside the function',
            'B. A local std::vector declared inside the function',
            'C. A reference parameter that was passed into the function',
            'D. A new-allocated int that you haven\'t deleted yet'
          ],
          answerIndex: 2,
          explanation: 'A reference parameter refers to something that exists in the caller\'s scope — it won\'t be destroyed when your function returns. Returning it by reference is safe.'
        }
      }
    ]
  },
  {
    id: 'ch6',
    title: 'Chapter 6 — The STL Toolkit',
    lessons: [
      {
        id: '6.1',
        title: 'Lesson 6.1 — std::vector',
        content: [
          '<code>std::vector</code> is the array you\'ll use for almost every DSA problem. Dynamic size, O(1) access, O(1) amortised push_back. You\'ll learn the internals in Unit 1 — for now, learn the interface.',
          '<pre><code>#include &lt;vector&gt;\nusing namespace std;\n\nvector&lt;int&gt; v;              // empty vector\nvector&lt;int&gt; v2(5, 0);      // 5 elements, all 0\nv.push_back(10);           // append — O(1) amortised\nv.pop_back();              // remove last — O(1)\nv[2];                      // access by index — O(1)</code></pre>',
          'One thing to watch out for: <code>v.size()</code> returns an <code>unsigned</code> type (<code>size_t</code>). If you write <code>v.size() - 1</code> on an empty vector, you get unsigned underflow — a huge number, not -1. Either check <code>v.empty()</code> first or cast: <code>(int)v.size() - 1</code>.'
        ],
        codeExercise: {
          instruction: 'Write a function that returns a new vector containing only the even numbers from the input.',
          templateCode: `#include <vector>
#include <iostream>
using namespace std;

vector<int> filter_even(const vector<int>& v) {
    // TODO: return a new vector with only even elements from v
}

int main() {
    vector<int> v = {1, 2, 3, 4, 5, 6, 7, 8};
    vector<int> result = filter_even(v);
    for (int x : result) cout << x << " ";
    // Expected: 2 4 6 8
}`,
          solutionCode: `vector<int> filter_even(const vector<int>& v) {
    vector<int> evens;
    for (int x : v) {
        if (x % 2 == 0) {
            evens.push_back(x);
        }
    }
    return evens;
}`,
          explanation: 'Iterate through the vector `v` using a range-based for loop. Check if the element `x % 2 == 0`, and if so, call `evens.push_back(x)` to append it to our results vector.'
        }
      },
      {
        id: '6.2',
        title: 'Lesson 6.2 — std::pair and structured bindings',
        content: [
          '<code>std::pair</code> holds two values of potentially different types. You\'ll see it constantly — as return values when you need to return two things, as elements of a vector when each entry has two components, and as the value type in maps.',
          '<pre><code>#include &lt;utility&gt;\nusing namespace std;\n\npair&lt;int, int&gt; p = {3, 7};\ncout &lt;&lt; p.first;    // 3\ncout &lt;&lt; p.second;   // 7\n\n// C++17 structured bindings\nauto [a, b] = p;   // a = 3, b = 7</code></pre>',
          'Structured bindings (<code>auto [a, b] = ...</code>) are C++17 and you should use them — they make pair-heavy code dramatically more readable.'
        ],
        mcq: {
          question: 'You have vector<pair<int,int>> v = {{3,1},{1,2},{2,3}}. You call sort(v.begin(), v.end()). What order are the pairs in after sorting?',
          options: [
            'A. {{3,1},{2,3},{1,2}} — sorted by second element',
            'B. {{1,2},{2,3},{3,1}} — sorted by first element, then second',
            'C. Undefined — pairs don\'t support sorting',
            'D. {{1,2},{3,1},{2,3}} — sorted by second element descending'
          ],
          answerIndex: 1,
          explanation: 'std::pair has a built-in less-than operator that compares first elements first, then second elements as a tiebreaker. So sort gives lexicographical order.'
        }
      },
      {
        id: '6.3',
        title: 'Lesson 6.3 — std::string',
        content: [
          'In C++, <code>std::string</code> is the type you\'ll use for string problems. Unlike C-style <code>char*</code> strings, it\'s a proper object with a known size, safe indexing, and useful methods.',
          '<pre><code>#include &lt;string&gt;\nusing namespace std;\n\nstring s = "hello";\ns.size();           // 5\ns[0] = \'H\';        // strings are mutable in C++\ns.substr(1, 3);     // "ell" — substr(start, length)</code></pre>',
          'The character subtraction trick — <code>c - \'0\'</code> to convert a digit character to its integer value — shows up in almost every string problem. Characters are just integers under the hood (<code>\'0\'</code> is ASCII 48), so subtracting <code>\'0\'</code> gives you the numeric value.'
        ],
        codeExercise: {
          instruction: 'Write a function that reverses a string in-place using two pointers.',
          templateCode: `#include <string>
#include <iostream>
using namespace std;

void reverse_string(string& s) {
    // TODO: reverse s in-place using two pointers
    // Do NOT use std::reverse or any library function
}

int main() {
    string s = "hello";
    reverse_string(s);
    cout << s << "\\n";   // Expected: olleh
}`,
          solutionCode: `void reverse_string(string& s) {
    if (s.empty()) return;
    int left = 0;
    int right = s.size() - 1;
    while (left < right) {
        char temp = s[left];
        s[left] = s[right];
        s[right] = temp;
        left++;
        right--;
    }
}`,
          explanation: 'Use a two-pointer technique: one index starting at `0` (left) and one at `size - 1` (right). Swap the characters at these indices, then increment left and decrement right until they meet in the middle.'
        }
      },
      {
        id: '6.4',
        title: 'Lesson 6.4 — auto and range-based for loops',
        content: [
          '<code>auto</code> tells the compiler to figure out the type for you. It\'s not dynamic typing — the type is still fixed at compile time, the compiler just infers it from the right-hand side. Use it when the type is obvious from context.',
          '<pre><code>auto x = 42;                  // int\nauto v = vector&lt;int&gt;{1,2,3};  // vector&lt;int&gt;\nauto it = v.begin();          // clean iterator type</code></pre>',
          'Range-based for loops iterate over any container without needing indices:',
          '<pre><code>for (int x : v)       // x is a copy\nfor (int& x : v)      // x is a reference (modifiable)\nfor (const auto& x : v) // const reference — efficient, read-only</code></pre>'
        ],
        mcq: {
          question: 'You write: for (auto x : v) { x = 0; } on a vector<int>. After the loop, what are the values in v?',
          options: [
            'A. All zeros — x modifies the elements',
            'B. Unchanged — x is a copy, modifying it doesn\'t affect v',
            'C. Compiler error — you can\'t assign inside a range-based for',
            'D. Undefined behaviour'
          ],
          answerIndex: 1,
          explanation: 'auto x creates a copy of each element. Changing x changes the copy, not the original. To modify the vector\'s elements, you need auto& x.'
        }
      }
    ]
  }
];

export const placementQuestions: PlacementQuestion[] = [
  {
    id: 1,
    question: 'You get an "undefined reference" linker error. What does this mean?',
    options: [
      'A. You have a syntax error in your code',
      'B. The compiler can\'t find a header file',
      'C. The linker found a declaration but no matching implementation',
      'D. You forgot to include <iostream>'
    ],
    answerIndex: 2,
    answerLabel: 'C',
    explanation: 'Declarations let the compiler compile, but the linker must find the matching definitions (implementations) in object files or libraries to link the final binary.'
  },
  {
    id: 2,
    question: 'An array stores values up to 10^9. You sum all 10^5 elements. What type should the sum be?',
    options: [
      'A. int',
      'B. float',
      'C. long long',
      'D. unsigned int'
    ],
    answerIndex: 2,
    answerLabel: 'C',
    explanation: 'The maximum sum is 10^14. The max capacity of int is ~2.1 × 10^9. To avoid silent integer overflow, you must use long long (up to ~9.2 × 10^18).'
  },
  {
    id: 3,
    question: 'int x = 5; int* p = &x; (*p)++; — what is the value of x after this runs?',
    options: [
      'A. 5',
      'B. 6',
      'C. The address of x + 1',
      'D. Undefined'
    ],
    answerIndex: 1,
    answerLabel: 'B',
    explanation: '(*p) dereferences p (accessing x\'s memory address) and the ++ increments the value directly inside that memory location to 6.'
  },
  {
    id: 4,
    question: 'When should you prefer passing by const reference over passing by value?',
    options: [
      'A. Always — references are always faster',
      'B. When the argument is a large object and you don\'t need to modify it',
      'C. When you need to modify the original',
      'D. Only for primitive types like int and char'
    ],
    answerIndex: 1,
    answerLabel: 'B',
    explanation: 'Passing large structures (like vectors or strings) by value copies the entire object. Passing by const reference (const T&) passes a reference without overhead and guarantees read-only access.'
  },
  {
    id: 5,
    question: 'What happens to heap memory allocated with "new" when the function that allocated it returns?',
    options: [
      'A. It is automatically freed',
      'B. It persists until explicitly freed with delete',
      'C. It moves to the caller\'s stack frame',
      'D. The OS reclaims it immediately'
    ],
    answerIndex: 1,
    answerLabel: 'B',
    explanation: 'Heap memory lifetimes are managed manually. Unless you explicitly call delete or delete[], heap allocations remain in memory, causing leaks.'
  },
  {
    id: 6,
    question: 'void foo(int a = 1, int b, int c = 3) — why does this fail to compile?',
    options: [
      'A. You can\'t use default arguments in C++17',
      'B. b has no default but c after it does — defaults must be at the end',
      'C. You can only have one default argument per function',
      'D. a and c can\'t both have the same default position'
    ],
    answerIndex: 1,
    answerLabel: 'B',
    explanation: 'Once a default value is defined, all subsequent parameters to its right must also have default parameters.'
  }
];
