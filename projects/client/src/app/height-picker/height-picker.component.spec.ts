import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeightPickerComponent } from './height-picker.component';

describe('HeightPickerComponent', () => {
  let component: HeightPickerComponent;
  let fixture: ComponentFixture<HeightPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeightPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeightPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
